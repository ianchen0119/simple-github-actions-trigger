// Copyright (c) 2020 DevilTea
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const session = require('koa-generic-session');
const convert = require('koa-convert');
const CSRF = require('koa-csrf');
const Router = require('koa-router')
const fs = require('fs')
const Axios = require('axios').default
const config = require('./config.json')
const identity = encodeURIComponent(config.travis.repository.id || config.travis.repository.slug)

function delay (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function axios() {
  return Axios.create({
    headers: {
      'Travis-API-Version': 3,
      'Authorization': `token ${config.travis.token}`,
      'User-Agent': 'API Explorer'
    }
  })
}

async function start() {
  async function getTravisRepoSlug() {
    const { data } = await axios().get(`https://api.travis-ci.org/repo/${identity}`)
    return data.slug
  }
  async function getBuildStatus() {
    try {
      const { data } = await axios().get(`https://api.travis-ci.org/repo/${identity}/builds?limit=1`)
      switch (data.builds[0].state) {
        case "passed":
          return "success";
        case "failed":
          return "failed";
        case "canceled":
          return "canceled"
        default:
          return "pending";
      }
    } catch (err) {
      console.error(err);
      return "unknown";
    }
  }
  async function triggerBuild() {
    await axios().post(`https://api.travis-ci.org/repo/${identity}/requests`, {
      request: {
        branch: config.travis.repository.branch
      }
    })
  }

  const repoSlug = await getTravisRepoSlug()
  const indexTemplate = (() => {
    return fs.readFileSync('./template/index.template.html')
      .toString()
      .replace(/%{REPO}%/g, repoSlug)
  })()
  let currentStatus = await getBuildStatus()
  let isTriggerBuffering = false

  function newInterval () {
    return setInterval(async () => {
      currentStatus = isTriggerBuffering || await getBuildStatus()
    }, 5000)
  }
  let interval = newInterval()

  const router = new Router()

  router.get('/', async (ctx) => {
    ctx.status = 200
    ctx.body = indexTemplate
      .replace(/%{CSRF}%/g, ctx.csrf)
  })

  router.get('/api/status', async (ctx) => {
    ctx.status = 200
    ctx.body = {
      status: currentStatus
    }
  })

  router.post('/api/builds', async (ctx) => {
    if (currentStatus !== 'pending' && !isTriggerBuffering) {
      isTriggerBuffering = true
      clearInterval(interval)
      interval = null
      currentStatus = 'pending'
      await triggerBuild()
      setTimeout(() => {
        isTriggerBuffering = false
        interval = interval || newInterval()
      }, 30000)
    }
    ctx.status = 201
  })

  const app = new Koa();


  // set the session keys
  app.keys = config.sessionKeys;

  // add session support
  app.use(convert(session()));

  // add body parsing
  app.use(bodyParser());

  // add the CSRF middleware
  app.use(new CSRF({
    invalidTokenMessage: 'Invalid CSRF token',
    invalidTokenStatusCode: 403,
    excludedMethods: ['GET', 'HEAD', 'OPTIONS'],
    disableQuery: false
  }));

  app.use(router.routes());
  app.use(router.allowedMethods());

  app.listen(config.port, () => console.log(`Service is online: http://localhost:${config.port}`));
}

start().catch((error) => console.log(error))
