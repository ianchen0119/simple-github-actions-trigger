/* 
 *  Based on simple-travis-ci-trigger project
 *  Copyright (c) 2020 DevilTea
 * 
 *  This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const session = require('koa-generic-session');
const convert = require('koa-convert');
const CSRF = require('koa-csrf');
const Router = require('koa-router');
const fs = require('fs');
const { Octokit } = require('@octokit/core');
const config = require('./config.json');
const repo = config.github_actions.repository;

function octokit() {
  return new Octokit({
    auth: config.github_actions.token,
    userAgent: 'API explorer',
    timeZone: 'Asia/Taipei'
  });
}

async function start() {
  async function triggerBuild(){
    await octokit().request(`/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`, {
      owner: repo.owner,
      repo: repo.name,
      workflow_id: repo.workflow_id,
      ref: repo.branch
    });
  }
  async function getBuildStatus() {
    try {
      const { data } = await octokit().request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
        owner: repo.owner,
        repo: repo.name,
        workflow_id: repo.workflow_id
      });

      if (data.total_count === 0) {
        return "unknown";
      }

      const run = data.workflow_runs[0];

      switch (run.status) {
        /*
         * status: completed
         * conclusion: “success”, “failure”, “neutral”, “cancelled”, “skipped”, “timed_out”, or “action_required”.
         * only indicate the workflow run is finished, need to log conclusion message
         */
        case "completed":
          return run.conclusion;
        case "in_progress":
          return "running";
        default:
          return "queued";
      }
    } catch (err) {
      console.error(err);
      return "unknown";
    }
  }

  const indexTemplate = (() => {
    return fs.readFileSync('./template/index.template.html')
      .toString()
      .replace(/%{REPO}%/g, repo.owner + '/' + repo.name);
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
    if (currentStatus !== 'queued' && !isTriggerBuffering) {
      isTriggerBuffering = true
      clearInterval(interval)
      interval = null
      currentStatus = 'queued'
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
