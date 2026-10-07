package egovframework.po.service;

import java.io.Serializable;

/**
 * 구매요청 임시저장 VO
 */
public class PrVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 제목 */
    private String title;

    /** 요청 내용 */
    private String content;

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }
}
