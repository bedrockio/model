import logger from '@bedrockio/logger';

export default function warn(...lines) {
  if (process.env.ENV_NAME !== 'test') {
    logger.warn(lines.join('\n'));
  }
}
