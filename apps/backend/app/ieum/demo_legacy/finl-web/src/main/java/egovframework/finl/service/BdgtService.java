package egovframework.finl.service;

import java.util.List;
import java.util.Map;

/** 예산 확인 서비스 */
public interface BdgtService {

    List<Map<String, Object>> selectBdgtCnfm(Map<String, Object> param) throws Exception;
}
