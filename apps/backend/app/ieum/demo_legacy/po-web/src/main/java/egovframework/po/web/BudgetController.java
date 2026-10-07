package egovframework.po.web;

import java.util.HashMap;
import java.util.Map;

import javax.annotation.Resource;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseBody;

import egovframework.po.service.BudgetSearchVO;
import egovframework.po.service.BudgetService;

/**
 * 예산 조회 컨트롤러
 */
@Controller
public class BudgetController {

    @Resource(name = "budgetService")
    private BudgetService budgetService;

    /** 부서별 예산 잔액 조회 */
    @RequestMapping(value = "/budgetRemain.do", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> budgetRemain(BudgetSearchVO searchVO) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("list", budgetService.selectBudgetRemain(searchVO));
        result.put("RSLT", "0000");
        return result;
    }
}
