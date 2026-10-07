package egovframework.po.web;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import egovframework.po.service.VendSearchVO;
import egovframework.po.service.VendService;

/**
 * 거래처 관리 컨트롤러
 */
@Controller
public class VendController {

    @Autowired
    private VendService vendService;

    /** 거래처 목록 화면 */
    @RequestMapping("/vendListView.do")
    public String vendListView() throws Exception {
        return "vend/vendList";
    }

    /** 거래처 목록 조회 */
    @GetMapping("/vendList.do")
    @ResponseBody
    public Map<String, Object> vendList(VendSearchVO searchVO) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("list", vendService.selectVendList(searchVO));
        result.put("RSLT", "0000");
        return result;
    }
}
