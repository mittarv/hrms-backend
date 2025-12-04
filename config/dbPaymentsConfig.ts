interface PoolConfig {
  max: number;
  min: number;
  acquire: number;
  idle: number;
}

interface DbPaymentsConfig {
  HOST: string;
  USER: string;
  PASSWORD: string;
  DB: string;
  dialect: string;
  pool: PoolConfig;
}

const dbPaymentsConfig: DbPaymentsConfig = {
  HOST: process.env.DATABASE_PAYMENTS_HOST || "",
  USER: process.env.DATABASE_PAYMENTS_USER || "",
  PASSWORD: process.env.DATABASE_PAYMENTS_PASSWORD || "",
  DB: process.env.DATABASE_PAYMENTS_NAME || "",
  dialect: process.env.DATABASE_PAYMENTS_DIALECT || "",
  pool: {
    max: 40,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
};

export default dbPaymentsConfig;
