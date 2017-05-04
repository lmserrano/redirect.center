import vhost from 'vhost'
import os from 'os'
import config from '../config'

export default vhost(config.fqdn, (req, res) => {
  const context = {
    config: config,
    uptime: os.uptime()
  }

  res.render('index.ejs', context)
})