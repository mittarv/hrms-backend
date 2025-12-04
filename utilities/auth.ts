import jwt, { SignOptions } from 'jsonwebtoken';
import { db } from '../models';
import { Op } from 'sequelize';
import { DeviceInfo, TokenPayload, TokenResponse } from '../interfaces/platformInterfaces/interfaces/userControllerInterface';

const {
    authTokens: AuthToken,
    refreshTokens: RefreshToken,
} = db

const REFRESH_TOKEN_SECRET: string = process.env.REFRESH_TOKEN_SECRET || 'mittarv' as string;
const SECRET_KEY: string = process.env.SECRET_KEY || 'mittarv' as string;

const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '72h';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

// Convert days/hours to milliseconds for database expiry
const TOKEN_EXPIRY_MS = (TOKEN_EXPIRY)?.slice(0, -1) === 'd' ? parseInt(TOKEN_EXPIRY.slice(0, -1)) * 24 * 60 * 60 * 1000 : parseInt(TOKEN_EXPIRY || '1h'.slice(0, -1)) * 60 * 60 * 1000;

const REFRESH_TOKEN_EXPIRY_MS = (REFRESH_TOKEN_EXPIRY)?.slice(0, -1) === 'd' ? parseInt(REFRESH_TOKEN_EXPIRY.slice(0, -1)) * 24 * 60 * 60 * 1000 : parseInt(REFRESH_TOKEN_EXPIRY || '7d'.slice(0, -1)) * 60 * 60 * 1000;

/**
 * Generates both access and refresh tokens for a user
 */
export const generateTokens = async (
  payload: TokenPayload,
  deviceInfo: DeviceInfo
): Promise<TokenResponse> => {
  try {
    const [accessToken, refreshToken] = await Promise.all([
      jwt.sign(
        payload,
        SECRET_KEY as string,
        { expiresIn: TOKEN_EXPIRY as string } as SignOptions
      ),
      jwt.sign(
        payload, 
        REFRESH_TOKEN_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRY as string } as SignOptions
      )
    ]);

    const now = new Date();


    const newRefreshToken = await RefreshToken.create({
      token: refreshToken,
      userId: payload.id,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_EXPIRY_MS),
      userAgent: deviceInfo.userAgent,
      deviceToken: deviceInfo.deviceToken,
      deviceName: deviceInfo.deviceName,
      lastUsed: now,
      refreshCount: 0,
      isDeleted: false
    });


    await AuthToken.create({
      token: accessToken,
      userId: payload.id, 
      expiresAt: new Date(now.getTime() + TOKEN_EXPIRY_MS),
      refreshTokenId: newRefreshToken.id,
      isDeleted: false
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: TOKEN_EXPIRY_MS
    };
  } catch (error) {
    if(error instanceof jwt.JsonWebTokenError){
        throw("Error with generation of tokens")
    } 
    throw error;
  }
};

/**
 * Refreshes an access token using a valid refresh token
 */
export const refreshAccessToken = async (
  refreshToken: string,
): Promise<string> => {
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET as string) as TokenPayload;
    
    const storedRefreshToken = await RefreshToken.findOne({
      where: { 
        token: refreshToken,
        isDeleted: false,
        userId: decoded.id,
      }
    });

    if (!storedRefreshToken) {
      throw new Error('Invalid refresh token');
    }

    // Check if refresh token is expired
    if (storedRefreshToken.expiresAt < new Date()) {
      await storedRefreshToken.update({ isDeleted: true });
      throw new Error('Refresh token expired');
    }

    
    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        id: decoded.id,
      },
      SECRET_KEY as string,
      { expiresIn: TOKEN_EXPIRY as string } as SignOptions
    );

    // Update refresh token usage
    await storedRefreshToken.update({
      lastUsed: new Date(),
      refreshCount: storedRefreshToken.refreshCount + 1
    });

    // Store new auth token
    await AuthToken.create({
      token: newAccessToken,
      userId: decoded.id,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
      refreshTokenId: storedRefreshToken.id,
      lastUsed: new Date(),
      isDeleted: false
    });

    return newAccessToken;
  } catch (error) {
    console.log(error);
    throw new Error('Error refreshing access token');
  }
};

/**
 * Verifies an access token
 */
export const verifyAccessToken = async (token: string): Promise<TokenPayload | null> => {
  try {
    const decoded = jwt.verify(token, SECRET_KEY as string) as TokenPayload;
    const storedToken = await AuthToken.findOne({
      where: {
        token,
        isDeleted: false,
        expiresAt: {
          [Op.gt]: new Date(Date.now())
        }
      }
    });

    if (!storedToken) {
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token signature'); 
    }
    throw error;
  }
};

/**
 * Invalidates a refresh token
 */
export const invalidateRefreshToken = async (refreshToken: string): Promise<void> => {
  try {
    await RefreshToken.update(
      { isDeleted: true },
      { where: { token: refreshToken } }
    );

    // Also invalidate associated auth tokens
    await AuthToken.update(
      { isDeleted: true },
      { 
        where: { 
          refreshTokenId: refreshToken,
          isDeleted: false 
        } 
      }
    );
  } catch {
    throw new Error('Error invalidating refresh token');
  }
};

export const invalidateAuthToken = async (authToken: string): Promise<void> => {
  try {
    await AuthToken.update({ isDeleted: true }, { where: { token: authToken } });
  } catch {
    throw new Error('Error invalidating auth token');
  }
};


