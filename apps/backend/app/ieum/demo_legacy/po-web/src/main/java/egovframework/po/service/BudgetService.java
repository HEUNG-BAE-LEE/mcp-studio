package egovframework.po.service;

import java.util.List;
import java.util.Map;

/**
 * 예산 서비스
 */
public interface BudgetService {

    /** 부서별 예산 잔액 조회 */
    List<Map<String, Object>> selectBudgetRemain(BudgetSearchVO searchVO) throws Exception;
}
