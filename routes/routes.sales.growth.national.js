import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_GROUP_BY = {
  grp_brand: 't01.grp_brand',
  Team_Desc:  't01."Team_Desc"',
  BU_Desc:    't01."BU_Desc"',
};

const ALLOWED_FILTERS = {
  AD:                 't01."AD"',
  Team_Desc:          't01."Team_Desc"',
  BU_Desc:            't01."BU_Desc"',
  Ctg:                't01."Ctg"',
  grp_brand:          't01.grp_brand',
  branch_description: 't01.branch_description',
  channel:            't01.channel',
  data_flag:          't01.data_flag',
  prod_nm:            't01.prod_nm',
};

router.get("/", async (req, res) => {
  try {
    const { groupBy = "Team_Desc", ...filters } = req.query;
    const groupByCol = ALLOWED_GROUP_BY[groupBy];
    if (!groupByCol) {
      return res.status(400).json({
        success: false,
        message: `Invalid groupBy. Allowed: ${Object.keys(ALLOWED_GROUP_BY).join(", ")}`,
      });
    }

    // Build dynamic filter clauses from query params
    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n") : "";

    const sql = `
      SELECT
          ${groupByCol} AS group_name,
          SUM(CASE
              WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  t01.billing_date <= CURRENT_DATE
              THEN t01.gross_amount ELSE 0
          END) AS "RD_CMS_TP",
          SUM(CASE
              WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN t01.gross_amount ELSE 0
          END) AS "RD_LMS_TP",
          ROUND(
              (
                  SUM(CASE
                      WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND  t01.billing_date <= CURRENT_DATE
                      THEN t01.gross_amount ELSE 0
                  END)::numeric
                  -
                  SUM(CASE
                      WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN t01.gross_amount ELSE 0
                  END)::numeric
              )
              /
              NULLIF(
                  SUM(CASE
                      WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND  t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN t01.gross_amount ELSE 0
                  END)::numeric
              , 0)
              * 100
          , 1) AS "S_Grw%"
      FROM vw_invoice_productmap t01
      WHERE
          t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND t01.billing_date <= CURRENT_DATE
          ${filterSQL}
      GROUP BY ${groupByCol}
      ORDER BY "S_Grw%" DESC;
    `;

    const results = await db.sequelize.query(sql, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT,
    });

    res.json({ success: true, groupBy, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

router.get("/table", async (req, res) => {
  try {
    const { groupBy = "Team_Desc", ...filters } = req.query;
    const groupByCol = ALLOWED_GROUP_BY[groupBy];
    if (!groupByCol) {
      return res.status(400).json({
        success: false,
        message: `Invalid groupBy. Allowed: ${Object.keys(ALLOWED_GROUP_BY).join(", ")}`,
      });
    }

    // Build dynamic filter clauses from query params
    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n") : "";
    const sql = `
      SELECT
          "AD",
          "BU_Desc",
          "Team_Desc",
          grp_brand,
          sap_item_dessc,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  billing_date <= CURRENT_DATE
              THEN sold_qty ELSE 0
          END) AS RD_CMU,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  billing_date <= CURRENT_DATE
              THEN gross_amount ELSE 0
          END) AS RD_CMS_TP,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
              AND  billing_date <= CURRENT_DATE
              THEN "EFP_Cur" * sold_qty ELSE 0
          END) AS RD_CMS_EFP,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN sold_qty ELSE 0
          END) AS RD_LMU,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN gross_amount ELSE 0
          END) AS RD_LMS_TP,
          SUM(CASE
              WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
              AND  billing_date <= (CURRENT_DATE - INTERVAL '1 month')
              THEN "EFP_Cur" * sold_qty ELSE 0
          END)  AS RD_LMS_EFP,
          ROUND(
              (
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND billing_date <= CURRENT_DATE
                      THEN sold_qty ELSE 0 END)::numeric
                  -
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN sold_qty ELSE 0 END)::numeric
              )
              / NULLIF(
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN sold_qty ELSE 0 END)::numeric
              , 0) * 100
          , 1)  AS "RD_Unit%",
          ROUND(
              (
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND billing_date <= CURRENT_DATE
                      THEN gross_amount ELSE 0 END)::numeric
                  -
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN gross_amount ELSE 0 END)::numeric
              )
              / NULLIF(
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN gross_amount ELSE 0 END)::numeric
              , 0) * 100
          , 1)  AS "RD_TP_Val%",
          ROUND(
              (
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND billing_date <= CURRENT_DATE
                      THEN "EFP_Cur" * sold_qty ELSE 0 END)::numeric
                  -
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN "EFP_Cur" * sold_qty ELSE 0 END)::numeric
              )
              / NULLIF(
                  SUM(CASE WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      AND billing_date <= (CURRENT_DATE - INTERVAL '1 month')
                      THEN "EFP_Cur" * sold_qty ELSE 0 END)::numeric
              , 0) * 100
          , 1)                                                            AS "RD_EFP_Val%"
      FROM vw_invoice_productmap t01
      WHERE
          billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND billing_date <= CURRENT_DATE
          ${filterSQL}
      GROUP BY
          "AD",
          "BU_Desc",
          "Team_Desc",
          grp_brand,
          sap_item_dessc
      ORDER BY
    "AD", "BU_Desc", "Team_Desc", grp_brand;
    `;

    const results = await db.sequelize.query(sql, {
      replacements,
      type: db.sequelize.QueryTypes.SELECT,
    });

    res.json({ success: true, groupBy, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

export default router;
