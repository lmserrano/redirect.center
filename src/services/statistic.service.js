import Promise from 'es6-promise'
import parseDomain from 'parse-domain'
import redis from 'redis'
import bluebird from 'bluebird'
import config from '../config'
import LoggerHandler from '../handlers/logger.handler'

export default class StatisticService {

  constructor (req) {
    if (config.activateCounter !== 'true') return true

    if (!global.redisClient) {
      bluebird.promisifyAll(redis.RedisClient.prototype)
      bluebird.promisifyAll(redis.Multi.prototype)
      global.redisClient = redis.createClient({
        host: config.redisHost,
        port: config.redisPort
      })
    }
    this.redisClient = global.redisClient
    this.req = req
    this.logger = new LoggerHandler()
    this.path = `${this.req.requestId} StatisticService`
  }

  put (hostname) {
    return new Promise((resolve, reject) => {
      if (config.activateCounter !== 'true') return true

      let parse = parseDomain(hostname)
      this.redisClient.set(`ever_hosts_${parse.subdomain}.${parse.domain}.${parse.tld}`, '1')
      this.redisClient.set(`ever_domains_${parse.domain}.${parse.tld}`, '1')
      this.redisClient.set(`24h_hosts_${parse.subdomain}.${parse.domain}.${parse.tld}`, '1', 'EX', 86400)
      this.redisClient.set(`24h_domains_${parse.domain}.${parse.tld}`, '1', 'EX', 86400)
      parse = null
      this.logger.info(`${this.path} put ${hostname}`)
      resolve(true)
    })
  }

  overview () {
    return new Promise((resolve, reject) => {
      if (config.activateCounter !== 'true') resolve()

      const everHosts = this.redisClient.send_commandAsync('eval', ['return table.getn(redis.call("keys", "ever_hosts_*"))', 0])
      const everDomains = this.redisClient.send_commandAsync('eval', ['return table.getn(redis.call("keys", "ever_domains_*"))', 0])
      const periodHosts = this.redisClient.send_commandAsync('eval', ['return table.getn(redis.call("keys", "24h_hosts_*"))', 0])
      const periodDomains = this.redisClient.send_commandAsync('eval', ['return table.getn(redis.call("keys", "24h_domains_*"))', 0])

      return Promise.all([everHosts, everDomains, periodHosts, periodDomains]).then((result) => {
        this.logger.info(`${this.path} overview then`)
        resolve({
          everHosts: result[0],
          everDomains: result[1],
          periodHosts: result[2],
          periodDomains: result[3]
        })
      }).catch((err) => {
        this.logger.info(`${this.path} overview catch ${err.message}`)
        reject(err)
      })
    })
  }
}