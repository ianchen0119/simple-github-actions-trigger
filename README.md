<!--
 Based on simple-travis-ci-trigger project
 Copyright (c) 2020 DevilTea
 
 This software is released under the MIT License.
 https://opensource.org/licenses/MIT
-->

# Simple Github Actions Trigger

A simple and tiny trigger page for Github actions.

## Quick Start

1. Generate your own access token.
  please click the [link](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) to get more details.

2. Configure your `config.json`. (ref: `config.example.json`)
  ```js
  {
  "port": 5000, // the port that service would be hosted
  "sessionKeys": ["keys", "keyskeys"], // keys for csrf
  "github_actions": {
    "token": "your github personal access token",
    "repository": {
      "owner": "COSCUP",
      "run_id": "", // workflow id
      "name": "2021"
    }
  }
}
  ```

2. Install dependencies
  ```bash
  $ npm i
  ```

3. Start the service
  ```bash
  $ npm run start
  ```

4. Check `localhost:{port}` in browser
  ![screenshot](./docs/images/screenshot.png)

## References
- [Creating CI tests with the Checks API](https://docs.github.com/en/developers/apps/creating-ci-tests-with-the-checks-api#step-13-creating-a-check-run)
- [Actions](https://docs.github.com/en/rest/reference/actions)
- [GitHub Actions 手动触发方式进化史](https://p3terx.com/archives/github-actions-manual-trigger.html)