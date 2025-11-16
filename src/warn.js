export default function warn(...lines) {
  if (process.env.ENV_NAME !== 'test') {
    // Allow warnings to be traced.
    process.emitWarning(lines.join('\n'));
  }
}
