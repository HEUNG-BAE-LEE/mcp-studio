package egovframework.po.service.impl;

import java.util.List;
import java.util.Map;

import javax.annotation.Resource;

import org.springframework.stereotype.Service;

import egovframework.po.service.BudgetSearchVO;
import egovframework.po.service.BudgetService;

/**
 * 예산 서비스 구현
 */
@Service("budgetService")
public class BudgetServiceImpl implements BudgetService {

    @Resource(name = "budgetDAO")
    private BudgetDAO budgetDAO;

    @Override
    public List<Map<String, Object>> selectBudgetRemain(BudgetSearchVO searchVO) throws Exception {
        return budgetDAO.selectBudgetRemain(searchVO);
    }
}
