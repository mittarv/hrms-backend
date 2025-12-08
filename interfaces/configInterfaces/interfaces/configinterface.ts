interface DbPoolConfig {
  max: number;
  min: number;
  acquire: number;
  idle: number;
}

export interface DbConfig {
  HOST: string;
  USER: string;
  PASSWORD: string;
  DB: string;
  dialect: string;
  pool: DbPoolConfig;
}

interface SeqConfig {
  database: string;
  username: string;
  password: string;
  dialect: string;
  host: string;
  port: number;
  migrationStorageTableName: string;
}

export interface SequelizeConfig {
  output: SeqConfig;
}


export function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}