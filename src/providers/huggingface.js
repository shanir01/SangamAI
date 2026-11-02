"use strict";
const { genericPrepare } = require("./generic");

// Hugging Face Inference Providers router (OpenAI-compatible).
// NOTE: free Hugging Face accounts get no monthly inference credits (PRO gets $2/month),
// so this provider is flagged free:false in router.config.json by default.
module.exports = {
  name: "huggingface",
  base_url: "https://router.huggingface.co/v1",
  api_key_env: "HF_TOKEN",
  headers(key) {
    return { authorization: "Bearer " + key };
  },
  prepareBody: genericPrepare,
};
