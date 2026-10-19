"""seed.DATA 를 pps_legacy DB 에 적재한다. 레거시 서버와 같은 원천이라 값이 서로 맞는다.

  PPS_LEGACY_DSN=postgresql://pps:pps@127.0.0.1:55432/pps_legacy python db/load.py
"""
import os
import sys
from pathlib import Path

import psycopg

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from legacy_pps.common.seed import DATA  # noqa: E402

DSN = os.environ.get("PPS_LEGACY_DSN", "postgresql://pps:pps@127.0.0.1:55432/pps_legacy")


def rows():
    D = DATA
    yield "TB_DMINSTT", [(c, n, t) for c, n, t in D["dminstt"]]
    yield "TB_ENTRPS", [(e["bizno"], e["corp_nm"], e["ceo_nm"], e["rgn_nm"], e["telno"], e["entrps_div"]) for e in D["entrps"]]
    seen = {}
    for p in D["prdct"]:
        seen[p["dtl_no"]] = (p["dtl_no"], p["clsfc_no"], p["dtl_nm"], p["unit"])
    yield "TB_PRDCT_CLSFC", list(seen.values())
    yield "TB_PRDCT_IDNT", [(p["idnt_no"], p["dtl_no"], p["model_nm"], p["maker_bizno"], p["unit_price"]) for p in D["prdct"]]
    yield "TB_BID_NTCE", [(b["bid_ntce_no"], b["bid_ntce_ord"], b["bid_ntce_nm"], b["ntce_kind_nm"], b["ntce_instt_cd"], b["dminstt_cd"],
                           b["bid_ntce_dt"], b["bid_clse_dt"], b["openg_dt"], b["presmpt_prce"], str(b["asign_bdgt_amt"]),
                           b["cntrct_cncls_mthd_nm"], b["dtl_no"], b["qty"], b["unit"]) for b in D["bids"]]
    yield "TB_OPNG_RSLT", [(o["bid_ntce_no"], o["bid_ntce_ord"], o["openg_dt"], o["prtcpt_cnum"], o["bidwinnr_bizno"], o["bidwinnr_nm"],
                            str(o["sucsfbid_amt"]), o["sucsfbid_rate"]) for o in D["opngs"]]
    yield "TB_CNTRCT", [(c["cntrct_no"], c["cntrct_chg_ord"], c["unty_no"], c["cntrct_nm"], c["cntrct_cncls_date"], c["cntrct_amt"],
                         c["dminstt_cd"], c["entrps_bizno"], c["bid_ntce_no"], c["dlvr_tmlmt_date"]) for c in D["cntrcts"]]
    yield "TB_DLVR_REQ", [(d["dlvr_req_no"], d["dlvr_req_date"], d["dminstt_cd"], d["idnt_no"], d["entrps_bizno"], d["qty"],
                           d["unit_price"], d["dlvr_amt"], d["dlvr_stts_cd"], d["use_yn"]) for d in D["dlvr"]]
    yield "TB_PYMNT", [(p["pymnt_req_no"], p["ref_kind"], p["ref_no"], p["dminstt_cd"], p["entrps_bizno"], p["req_date"],
                        f"{p['req_amt']:,}", p["pymnt_stts_cd"], p["pymnt_date"] or None, p["acnt_div_cd"], p["bdgt_acnt_nm"]) for p in D["pymnt"]]
    yield "TB_CMMN_CD", [(k, c, n, "Y") for k, vs in D["codes"].items() for c, n in vs]
    yield "TB_STCK", [(s["item_cd"], s["site_cd"], s["item_nm"], s["site_nm"], s["stock_qty"], s["unit"], s["base_ymd"]) for s in D["stock"]]


def main():
    with psycopg.connect(DSN, autocommit=False) as con:
        con.execute((HERE / "schema.sql").read_text(encoding="utf-8"))
        for table, data in rows():
            if not data:
                continue
            ph = ",".join(["%s"] * len(data[0]))
            with con.cursor() as cur:
                cur.executemany(f"INSERT INTO {table} VALUES ({ph})", data)
            print(f"{table:16} {len(data):4}")
        con.commit()


if __name__ == "__main__":
    main()
