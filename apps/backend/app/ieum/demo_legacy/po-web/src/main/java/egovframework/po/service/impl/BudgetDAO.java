package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Repository;

import egovframework.po.service.BudgetSearchVO;
import egovframework.rte.psl.dataaccess.EgovAbstractDAO;

/**
 * 예산 DAO. 예산 모듈은 MyBatis 로 옮기기 전의 iBatis(Budget_SQL.xml) 를 그대로 쓴다.
 */
@Repository("budgetDAO")
public class BudgetDAO extends EgovAbstractDAO {

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectBudgetRemain(BudgetSearchVO searchVO) throws Exception {
        return (List<Map<String, Object>>) list("budgetDAO.selectBudgetRemain", searchVO);
    }
}
