package egovframework.po.service;

import java.util.List;
import java.util.Map;

/**
 * 거래처 서비스
 */
public interface VendService {

    /** 거래처 목록 조회 */
    List<Map<String, Object>> selectVendList(VendSearchVO searchVO) throws Exception;
}
