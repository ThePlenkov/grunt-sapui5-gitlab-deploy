// fetch polyfill
const nodeFetch = require("node-fetch");
// cookie decorator 
const fetch = require("fetch-cookie")(nodeFetch);
// Gitlab API client
const Gitlab = require("gitlab/dist/es5").default;

module.exports = function(grunt) {
  "use strict";
    
  // deploy from gitlab to ABAP
  grunt.registerTask("gitlab_deploy", async function() {
    
    // must be async
    let done = this.async();

    try {
      
      // Instantiating the API
      const api = new Gitlab({
        url:
          process.env.GITLAB_HOST || new URL(process.env.CI_PROJECT_URL).origin, // Defaults to http://gitlab.com
        token: process.env.READ_TOKEN // Can be created in your profile.
      });

      // get current pipeline
      let aJobs = await api.Pipelines.showJobs(
        process.env.CI_PROJECT_ID,
        process.env.CI_PIPELINE_ID
      );

      // get last successfull build
      let oJob = aJobs
        .filter(oJob => oJob.stage === "build" && oJob.status === "success")
        .pop();

      // create URL for downloading dist.zip
      let sUrl = `${oJob.web_url}/artifacts/file/dist.zip?private_token=${
        process.env.READ_TOKEN
      }`;

      // deploy to ABAP ( sending artifact URL to a backend )
      await deployToABAP(sUrl);
    } catch (error) {
      grunt.log.error(error);
    }

    done();
  });

  async function deployToABAP(sUrl) {
    const base_auth = "Basic " + process.env.ABAP_BASIC_TOKEN;

    // first read to get CSRF token and set cookies
    let oLogin = await fetch(process.env.ABAP_DEPLOY_URL, {
      headers: {
        "Content-Type": "application/json",
        Authorization: base_auth,
        "X-CSRF-Token": "Fetch"
      }
    });

    return await fetch(
      process.env.ABAP_DEPLOY_URL + process.env.ABAP_DEPLOY_PATH,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: base_auth,
          "X-CSRF-Token": oLogin.headers.get("x-csrf-token")
        },
        body: JSON.stringify({
          Url: sUrl,
          AppId: process.env.ABAP_UI5_APP_NAME,
          RequestText: process.env.CI_COMMIT_TITLE
        })
      }
    );
  }
};
