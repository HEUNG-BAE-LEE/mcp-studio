package egovframework.finl.service;

import java.util.List;
import java.util.Map;

/** 대금 청구·지급 서비스 */
public interface PymntService {

    List<Map<String, Object>> selectPymntSttus(Map<String, Object> param) throws Exception;

    List<Map<String, Object>> selectPymntList(Map<String, Object> param) throws Exception;

    int insertPymntReq(Map<String, Object> param) throws Exception;
}
