package egovframework.po.web;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import egovframework.po.service.ItemService;

/**
 * 품목 관리 컨트롤러. 생성자 주입을 쓴다.
 */
@Controller
public class ItemController {

    private final ItemService itemService;

    @Autowired
    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    /** 품목 단가 조회 */
    @RequestMapping(value = "/itemPrice.do", method = RequestMethod.GET)
    @ResponseBody
    public Map<String, Object> itemPrice(@RequestParam("itemCd") String itemCd,
                                         @RequestParam(value = "vendCd", required = false) String vendCd) throws Exception {
        Map<String, Object> result = new HashMap<String, Object>();
        result.put("price", itemService.selectItemPrice(itemCd, vendCd));
        result.put("RSLT", "0000");
        return result;
    }
}
