package egovframework.po.service;

import java.util.List;
import java.util.Map;

/**
 * 구매요청 서비스
 */
public interface PrService {

    /** 구매요청 목록 조회 */
    List<Map<String, Object>> selectPrList(PrSearchVO searchVO) throws Exception;

    /** 구매요청 임시저장 */
    void saveDraft(PrVO prVO) throws Exception;

    /** 구매요청 상신 */
    void submitPr(String prNo) throws Exception;
}
