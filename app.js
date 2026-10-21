// cPanel/Passenger entry point. Keep startup errors on stderr: Passenger's
// generic "exited prematurely" message otherwise hides configuration errors.
import('./server/auth-server.mjs').catch((error) => {
  console.error('[IJESHA API startup failed]', error?.stack ?? error)
  process.exitCode = 1
})
