package egovframework.po.service;

/**
 * 품목 서비스
 */
public interface ItemService {

    /**
     * 품목 단가 조회. 거래처를 주면 그 거래처의 계약 단가, 안 주면 기준 단가.
     */
    ItemPriceVO selectItemPrice(String itemCd, String vendCd) throws Exception;
}
