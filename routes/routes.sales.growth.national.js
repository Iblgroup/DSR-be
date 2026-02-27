import express from "express";
import db from "../models/index.js";

const router = express.Router();

const ALLOWED_GROUP_BY = {
  grp_brand:          'grp_brand',
  team_desc:          'team_desc',
  bu_desc:            'bu_desc',
};

const ALLOWED_FILTERS = {
  AD:                 't01.ad',
  Team_Desc:          't01.team_desc',
  BU_Desc:            't01.bu_desc',
  Ctg:                't01.ctg',
  grp_brand:          't01.grp_brand',
  branch_description: 't01.branch_description',
  channel:            't01.channel',
  data_flag:          't01.data_flag',
  prod_nm:            't01.prod_nm',
};

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    const { groupBy = "team_desc", displayMode = "TP", ...filters } = req.query;

    const groupByKeys = groupBy.split(",").map((k) => k.trim());

    const invalidKeys = groupByKeys.filter((k) => !ALLOWED_GROUP_BY[k]);
    if (invalidKeys.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid groupBy value(s): ${invalidKeys.join(", ")}. Allowed: ${Object.keys(ALLOWED_GROUP_BY).join(", ")}`,
      });
    }

    const selectCols = groupByKeys
      .map((k) => `${ALLOWED_GROUP_BY[k]} AS "${k}"`)
      .join(",\n          ");

    const groupByClause = groupByKeys
      .map((k) => ALLOWED_GROUP_BY[k])
      .join(", ");

    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n          ") : "";

    const isEfp = displayMode === "EFP";

    const metricCols = isEfp
      ? `
          SUM(CASE
        WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND  t01.billing_date <= CURRENT_DATE
        THEN t01.gross_amount ELSE 0
    END) AS RD_CMS_TP,
    SUM(CASE
        WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND  t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month')
        THEN t01.gross_amount ELSE 0
    END) AS RD_LMS_TP,
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
    , 1) AS "S_Grw%"`
      : `
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01.sold_qty ELSE 0 END) AS RD_CMU,
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN efp * t01.sold_qty ELSE 0 END) AS CMV,
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN t01.sold_qty ELSE 0 END) AS RD_LMU,
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN efp * t01.sold_qty ELSE 0 END) AS PMV,
          ROUND(
              (
                  SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN efp * t01.sold_qty ELSE 0 END)::numeric
                  -
                  SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN efp * t01.sold_qty ELSE 0 END)::numeric
              )
              / NULLIF(
                  SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN efp * t01.sold_qty ELSE 0 END)::numeric
              , 0) * 100
          , 1) AS "S_Grw%"`;

    const sql = `
      SELECT * FROM (
        SELECT
          ${selectCols},
          ${metricCols}
        FROM vw_invoice_productmap t01
        WHERE t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
          AND t01.billing_date <= CURRENT_DATE
          ${filterSQL}
        GROUP BY ${groupByClause}
      ) a
    `;

    const results = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
      replacements,
    });

    res.json({ success: true, groupBy: groupByKeys, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

// ─── GET /table ───────────────────────────────────────────────────────────────

router.get("/table", async (req, res) => {
  try {
    const { displayMode: _displayMode = "TP", ...filters } = req.query;

    const filterClauses = [];
    const replacements = {};
    for (const [key, value] of Object.entries(filters)) {
      if (ALLOWED_FILTERS[key] && value) {
        filterClauses.push(`AND ${ALLOWED_FILTERS[key]} = :${key}`);
        replacements[key] = value;
      }
    }
    const filterSQL = filterClauses.length > 0 ? filterClauses.join("\n          ") : "";

    const sql = `
   select
	ad, 
    team_desc,
    bu_desc,
    ctg,
    branch_description,
    channel,
    data_flag,
    grp_brand,
SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN t01.sold_qty ELSE 0 END) AS RD_CMU,
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN efp * t01.sold_qty ELSE 0 END) AS CMV,
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN t01.sold_qty ELSE 0 END) AS RD_LMU,
          SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN efp * t01.sold_qty ELSE 0 END) AS PMV,
          ROUND(
              (
                  SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE) AND t01.billing_date <= CURRENT_DATE THEN efp * t01.sold_qty ELSE 0 END)::numeric
                  -
                  SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN efp * t01.sold_qty ELSE 0 END)::numeric
              )
              / NULLIF(
                  SUM(CASE WHEN t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND t01.billing_date <= (CURRENT_DATE - INTERVAL '1 month') THEN efp * t01.sold_qty ELSE 0 END)::numeric
              , 0) * 100
          , 1) AS "S_Grw%"
FROM vw_invoice_productmap t01
WHERE
    t01.billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND t01.billing_date <= CURRENT_DATE and ad IS NOT NULL
        ${filterSQL}
GROUP by
	ad, 
    team_desc,
    bu_desc,
    ctg,
    branch_description,
    channel,
    data_flag,
    grp_brand;
    `;
    const results = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
      replacements,
    });

    res.json({ success: true, count: results.length, data: results });
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
