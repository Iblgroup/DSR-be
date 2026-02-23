import express from "express";
import db from "../models/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const sql = `
SELECT
    "AD",
    "Team_Desc",
    "BU_Desc",
    "Ctg",
    branch_description,
    channel,
    data_flag,
    grp_brand,
    prod_nm,
    region_desc,
    SUM(CASE
        WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND  billing_date <= CURRENT_DATE
        THEN gross_amount ELSE 0
    END)AS CMV,
    SUM(CASE
        WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
        AND  billing_date <  DATE_TRUNC('month', CURRENT_DATE)
        THEN gross_amount ELSE 0
    END)AS PMV,
    ROUND(
        (
            SUM(CASE
                WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE)
                AND  billing_date <= CURRENT_DATE
                THEN gross_amount ELSE 0
            END)::numeric
            -
            SUM(CASE
                WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                AND  billing_date <  DATE_TRUNC('month', CURRENT_DATE)
                THEN gross_amount ELSE 0
            END)::numeric
        )
        /
        NULLIF(
            SUM(CASE
                WHEN billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                AND  billing_date <  DATE_TRUNC('month', CURRENT_DATE)
                THEN gross_amount ELSE 0
            END)::numeric
        , 0)
        * 100
    , 1) AS "S_Grw%"
FROM vw_invoice_productmap t01
inner join public.product_region t02
on t01.branch_id = t02.org_id::text
WHERE
    billing_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND billing_date <= CURRENT_DATE
GROUP BY
     "AD",
    "Team_Desc",
    "BU_Desc",
    "Ctg",
    branch_description,
    channel,
    data_flag,
    grp_brand,
    prod_nm,
    region_desc
ORDER BY
    "Ctg";
    `;

    const results = await db.sequelize.query(sql, {
      type: db.sequelize.QueryTypes.SELECT,
    });

    res.json({ success: true, count: results.length, data: results });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching data",
      error: error.message,
    });
  }
});

export default router;
