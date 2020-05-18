/*!
* This logger api is a sub-set of grunt's @ http://gruntjs.com/api/grunt.log
* with the methods used by preload.js.
* So the grunt logger can passed in and used instead.
*/
const { bold, cyan, green } = require('chalk')

class Logger {
  constructor(enabled) {
    this.setEnabled(enabled)
  }

  setEnabled(enabled) {
    this.enabled = enabled
    return this
  }

  write(msg) {
    process.stdout.write(msg)
    return this
  }

  writeln(...args) {
    console.log(...args)
    return this
  }

  subhead(msg) {
    console.log(bold(msg))
    return this
  }

  writeflags(obj, prefix) {
    console.log(prefix, cyan(JSON.stringify(obj)))
    return this
  }

  ok(msg) {
    console.log(green(msg || 'OK'))
    return this
  }
}

module.exports = {
  verbose: new Logger(false),
  log: new Logger(true)
}
