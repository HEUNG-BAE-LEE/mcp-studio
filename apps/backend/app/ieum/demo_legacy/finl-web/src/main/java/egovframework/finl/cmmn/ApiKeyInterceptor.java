package egovframework.finl.cmmn;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.web.servlet.handler.HandlerInterceptorAdapter;

/** X-API-KEY 검사. 키는 globals.properties 의 Globals.FinlApiKey 다. 틀리면 403 */
public class ApiKeyInterceptor extends HandlerInterceptorAdapter {

    private String apiKey;

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (apiKey != null && apiKey.equals(request.getHeader("X-API-KEY"))) {
            return true;
        }
        response.sendError(HttpServletResponse.SC_FORBIDDEN);
        return false;
    }
}
