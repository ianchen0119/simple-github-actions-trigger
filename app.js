/* 
 *  Based on simple-travis-ci-trigger project
 *  Copyright (c) 2020 DevilTea
 * 
 *  This software is released under the MIT License.
 */ https://opensource.org/licenses/MIT

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const session = require('koa-generic-session');
const convert = require('koa-convert');
const CSRF = require('koa-csrf');
const Router = require('koa-router')
const fs = require('fs')
const Axios = require('axios').default
const config = require('./config.json')
const repo = config.github_actions.repository

// function delay (ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms))
// }

function axios() {
  return Axios.create({
    headers: {
      'accept': 'application/vnd.github.v3+json',
      'Authorization': `token ${config.github_actions.token}`
    }
  })
}

async function start() {
  async function triggerBuild(){
    await axios().get(`https://api.github.com/repos/${repo.owner}/${repo.name}/actions/workflows/${repo.filename}/dispatches`)
    .then((res)=>{
      console.log(res);
    })
  }
  async function getBuildStatus() {
    try {
      const { data } = await axios().get(`https://api.github.com/repos/${repo.owner}/${repo.name}/actions/runs`)
      switch (data.workflow_runs[0].status) {
        /*  Status: success :3
         *  when all statuses and checks have a successful outcome.
         */
        case "success":
          return "success";
        /*  Status: failure QwQ
         *  when any status or check has failed, even though other checks might still be running.
         */
        case "failure":
          return "failure";
        /*  Status: error T~T
         *  when an error occurs, log output will include the response body.
         */
        case "error":
          return "error"
        /*  Status: rate_limited OAO!
         *  when the API calls this action makes are rate limited.
         */
        case "rate_limited":
          return "rate_limited";
        default:
          return "Queued";
      }
    } catch (err) {
      console.error(err);
      return "unknown";
    }
  }

  const indexTemplate = (() => {
    return fs.readFileSync('./template/index.template.html')
      .toString()
      .replace(/%{REPO}%/g, repo.name)
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
