const express = require("express");
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const swaggerUi = require("swagger-ui-express");

const router = express.Router();

const openApiPath = path.join(__dirname, "../../openapi.yaml");
const openApiDocument = YAML.parse(fs.readFileSync(openApiPath, "utf8"));

router.use("/", swaggerUi.serve, swaggerUi.setup(openApiDocument));

module.exports = router;
