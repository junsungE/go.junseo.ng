// Test if @azure/data-tables can be required
module.exports = async function (context, req) {
  const results = {
    step1_require_attempt: false,
    step2_table_client_class: false,
    step3_credential_class: false,
    errors: []
  };

  try {
    const dataTables = require("@azure/data-tables");
    results.step1_require_attempt = true;
    results.module_exports = Object.keys(dataTables).join(", ");

    if (dataTables.TableClient) {
      results.step2_table_client_class = true;
    }
    if (dataTables.AzureNamedKeyCredential) {
      results.step3_credential_class = true;
    }
  } catch (err) {
    results.errors.push({
      step: "require @azure/data-tables",
      error: err.message,
      stack: err.stack
    });
  }

  // Also test uuid
  try {
    const uuid = require("uuid");
    results.uuid_available = true;
    results.uuid_v4_test = uuid.v4 ? uuid.v4().substring(0, 8) : "no v4";
  } catch (err) {
    results.errors.push({
      step: "require uuid",
      error: err.message
    });
  }

  context.res = {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(results, null, 2)
  };
};
