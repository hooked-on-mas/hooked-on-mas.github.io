function runTranslation() {
    const API_URL = 'https://api-free.deepl.com/v2/translate';

    const substi_pre = "EQ";
    const len_substi_num = 2;

    let equation_list = [];

    // 初期化
    let idx = 0;
    let cnt = 0;

    let idx_start = 0;
    let idx_end = 0;
    let equation = "";
    let substi = "";
    

    const API_KEY = document.getElementById("deepl_api_key").value;
    if (API_KEY == "") {
        document.getElementById('output').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，入力してください．.";
        return;
    }

    let latex_code = document.getElementById("input_code").value;

    while(true){
        idx_start = latex_code.indexOf('$', idx);
        idx_end = latex_code.indexOf('$', idx_start + 1);

        // これ以上数式がなければ，ループを終了
        if (idx_start == -1){
            break;
        }

        // 数式をMathjax向けに変更．
        // 別行立て数式の場合
        if (idx_end - idx_start == 1){
            idx_end = latex_code.indexOf('$', idx_end + 1) + 1;
            equation = latex_code.slice(idx_start, idx_end + 1);

            // $$...$$を\[...\]に変換
            equation = "\\[" + equation.slice(2, equation.length - 2) + "\\]";
            
        // インライン数式の場合
        } else {
            equation = latex_code.slice(idx_start, idx_end + 1);
            
            // $...$を\(...\)に変換
            equation = "\\(" + equation.slice(1, equation.length - 1) + "\\)";
        }
    
        equation_list.push(equation);

        // 数式を代替（EQxxxx）に変換．
        substi = substi_pre + String(cnt).padStart(len_substi_num, '0');

        latex_code = latex_code.slice(0, idx_start) + substi + latex_code.slice(idx_end+1, latex_code.length);

        idx = idx_start + substi_pre.length + len_substi_num;
        cnt = cnt + 1;
    }

    latex_code = latex_code.replace(/\r?\n/g, ' ');

    // 翻訳

    let content = encodeURI('auth_key=' + API_KEY + '&text=' + latex_code + '&source_lang=EN&target_lang=JA');
    let url = API_URL + '?' + content;

    let translation_result = "";
  
    fetch(url)
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("Could not reach the API: " + response.statusText);
            }
        }).then(function(data) {
            translation_result = data["translations"][0]["text"];

            // 翻訳結果の数式に実際の数式を代入
            for (let i = 0; i < equation_list.length; i++) {

                equation = equation_list[i];

                substi = substi_pre + String(i).padStart(len_substi_num, '0');
                translation_result = translation_result.replace(substi, equation);
            }

            document.getElementById('output').textContent = translation_result;
            MathJax.typesetPromise()

        }).catch(function(error) {
            document.getElementById('output').textContent = error.message;
        });
}

function resetTextbox() {
    
    document.getElementById("input_code").value = "";
    document.getElementById("output").textContent = "";
}