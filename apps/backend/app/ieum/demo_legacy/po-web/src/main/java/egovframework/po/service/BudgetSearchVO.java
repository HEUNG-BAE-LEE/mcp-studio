package egovframework.po.service;

import java.io.Serializable;

import lombok.Data;

/**
 * 예산 잔액 조회 조건. 롬복(@Data)을 쓰는 몇 안 되는 VO 다.
 */
@Data
public class BudgetSearchVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 부서 코드 */
    private String deptCd;

    /** 예산 연도 (yyyy) */
    private String yyyy;
}
