export default () => ({
    port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
    nodeEnv: process.env.NODE_ENV ?? 'development',
    database: {
        url: process.env.DATABASE_URL,
    },
    jwt: {
        secret: process.env.JWT_SECRET ?? 'change_this_secret',
        expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    },
});
//# sourceMappingURL=app.config.js.map