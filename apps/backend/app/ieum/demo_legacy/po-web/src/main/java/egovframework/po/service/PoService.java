package egovframework.po.service;

import java.util.List;
import java.util.Map;

/**
 * 발주 서비스
 */
public interface PoService {

    /** 발주 목록 조회 */
    List<Map<String, Object>> selectPoList(PoSearchVO searchVO) throws Exception;

    /** 발주 상세 조회 */
    Map<String, Object> selectPoDetail(String poNo) throws Exception;

    /** 발주 등록. 발주번호를 채번해 저장하고 돌려준다. */
    String savePo(PoVO poVO) throws Exception;

    /** 발주 승인 */
    void approvePo(String poNo) throws Exception;

    /** 구 발주 목록 조회 */
    List<Map<String, Object>> selectOldPoList() throws Exception;
}
