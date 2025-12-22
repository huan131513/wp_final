from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import time

def crawl_with_selenium():
    # 1. 設定 Chrome：使用無頭模式（不彈出視窗）
    chrome_options = Options()
    chrome_options.add_argument("--headless") 
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")

    # 2. 啟動瀏覽器
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        print("正在透過 Selenium 模擬瀏覽器進入 7-11 電子地圖...")
        driver.get("https://emap.pcsc.com.tw/")
        
        # 等待網頁 JavaScript 加載完成
        time.sleep(3)

        # 3. 關鍵：在瀏覽器環境內執行 AJAX 請求（這能繞過所有 Headers 檢查）
        print("正在發送 AJAX 資料請求...")
        script = """
        var callback = arguments[arguments.length - 1];
        $.ajax({
            url: 'EMapService.aspx',
            type: 'POST',
            data: {
                commandid: 'SearchStore',
                city: '台北市',
                town: '大安區',
                roadname: '',
                ID: '',
                StoreName: '',
                SpecialStore_Kind: '',
                leftMenuChecked: ''
            },
            success: function(data) {
                var xmlString = new XMLSerializer().serializeToString(data);
                callback(xmlString);
            },
            error: function() {
                callback('error');
            }
        });
        """
        # 執行異步腳本
        result_xml = driver.execute_async_script(script)

        if result_xml == 'error' or not result_xml:
            print("請求失敗。")
            return

        # 4. 解析結果
        soup = BeautifulSoup(result_xml, "xml")
        stores = soup.find_all('GeoPosition')

        print(f"\n成功！在大安區找到 {len(stores)} 間門市")
        print("-" * 40)

        found_count = 0
        for poi in stores:
            name = poi.find('POIName').text.strip()
            address = poi.find('Address').text.strip()
            services = poi.find('StoreImageTitle').text if poi.find('StoreImageTitle') else ""
            
            if "02廁所" in services:
                print(f"✅ [有廁所] {name:<10} | {address}")
                found_count += 1
        
        print(f"\n總計有廁所的門市數量：{found_count}")

    except Exception as e:
        print(f"發生錯誤: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    crawl_with_selenium()