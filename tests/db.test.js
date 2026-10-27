// require("dotenv").config();

// const pool = require("../src/config/db");

// async function main() {
//   try {
//     const result = await pool.query(
//       "SELECT NOW() AS server_time, current_database() AS database",
//     );

//     console.log("Database connected:", result.rows[0]);
//   } catch (error) {
//     console.error("Database connection failed:", error.message);
//     process.exitCode = 1;
//   } finally {
//     await pool.end();
//   }
// }

// main();

require("dotenv").config({ path: ".env.test" });

const pool = require("../src/config/db");

describe("Test database", () => {
  afterAll(async () => {
    await pool.end();
  });

  test("connects to amrutam_test and finds required tables", async () => {
    const result = await pool.query(`
      SELECT current_database() AS database,
             to_regclass('public.users') AS users_table,
             to_regclass('public.consultations') AS consultations_table
    `);

    expect(result.rows[0].database).toBe("amrutam_test");
    expect(result.rows[0].users_table).toBe("users");
    expect(result.rows[0].consultations_table).toBe("consultations");
  });
});
