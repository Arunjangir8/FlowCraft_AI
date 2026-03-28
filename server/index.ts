import app from "./src/app";
import { AppEnv } from "./src/config";
import { isProduction } from "./src/config/constants";
import { logger } from "./src/shared/logger";

app.listen(AppEnv.PORT, () => {
	logger.info('Server started successfully', {
        PORT: AppEnv.PORT,
        environment: isProduction ? 'production' : 'development',
    });
});
