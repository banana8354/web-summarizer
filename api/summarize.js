// Vercel Serverless Function
// 把请求原样交给项目根目录的 handler 处理，避免逻辑重复
module.exports = require('../server.js');