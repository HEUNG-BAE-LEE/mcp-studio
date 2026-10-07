package egovframework.po.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * 테스트용 가짜 컨트롤러. 소스 분석이 src/test 를 건너뛰는지 확인하려고 실제 컨트롤러처럼 매핑을 단다.
 * 이 매핑(/testOnly.do)이 분석 결과에 나오면 안 된다.
 */
@Controller
public class PoControllerTest {

    @RequestMapping("/testOnly.do")
    @ResponseBody
    public String testOnly() {
        return "ok";
    }
}
