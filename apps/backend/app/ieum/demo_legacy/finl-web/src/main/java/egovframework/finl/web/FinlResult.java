package egovframework.finl.web;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 응답 봉투 — RESULT_CODE / RESULT_MSG / DATA_CNT / DATA */
public final class FinlResult {

    private FinlResult() {
    }

    public static Map<String, Object> ok(List<?> data) {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("RESULT_CODE", "S");
        result.put("RESULT_MSG", "정상 처리되었습니다.");
        result.put("DATA_CNT", data.size());
        result.put("DATA", data);
        return result;
    }
}
