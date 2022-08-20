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

    let is_inline_eq = false;

    let reduced_equation = "";
    let separated_equation = "";
    let substi_code_list = [];
    let idx_punc = 0;
    

    const API_KEY = document.getElementById("deepl_api_key").value;
    if (API_KEY == "") {
        document.getElementById('result').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，入力してください．.";
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

            is_inline_eq = false;
            
        // インライン数式の場合
        } else {
            equation = latex_code.slice(idx_start, idx_end + 1);
            
            // $...$を\(...\)に変換
            equation = "\\(" + equation.slice(1, equation.length - 1) + "\\)";

            is_inline_eq = true;

        }

        // 数式を一旦equation_listに保管して，EQxxで置き換えて翻訳し，数式に戻す
        // 置き換える時のコードはsubsti_code_listに入れる

        reduced_equation = equation;
        separated_equation = "";
        substi_code_list = [];

        while (true) {

            idx_punc = reduced_equation.search(/\.|,|;\:/);
            str_punc = reduced_equation[idx_punc];

            if (idx_punc == -1) {
                break;
            }

            // reduced_equation -> separated_equation + punctuation + reduced_equation
            separated_equation = reduced_equation.slice(0, idx_punc);
            reduced_equation = reduced_equation.slice(idx_punc + 1, reduced_equation.length);

            // separated_equation : \( xxxx  -> \( xxxx \)
            // reduced_equation   :  xxxx \) -> \( xxxx \)
            separated_equation = separated_equation + (is_inline_eq ? "\\)" : "\\]");
            reduced_equation   = (is_inline_eq ? "\\(" : "\\[") + reduced_equation;

            substi = substi_pre + String(cnt).padStart(len_substi_num, '0');
            cnt = cnt + 1;

            substi_code_list.push(substi);
            substi_code_list.push(str_punc);
            substi_code_list.push(" ");

            equation_list.push(separated_equation);

        }
        
        if (!/^\\(\(|\[)\s*\\(\)|\])$/.test(reduced_equation)) {

            // 数式を代替（EQxxxx）に変換．
            substi = substi_pre + String(cnt).padStart(len_substi_num, '0');
            cnt = cnt + 1;

            substi_code_list.push(substi);
            equation_list.push(reduced_equation);
            
        }

        latex_code = latex_code.slice(0, idx_start) + substi_code_list.join("") + latex_code.slice(idx_end + 1, latex_code.length);

        idx = idx_start + substi_code_list.join("").length;
    }

    // 翻訳
    let content = encodeURI('auth_key=' + API_KEY + '&text=' + latex_code + '&source_lang=EN&target_lang=JA');
    let url = API_URL + '?' + content;

    let translation_result = "";
  
    fetch(url)
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("DeepL APIにアクセスできません．");
            }
        }).then(function(data) {
            translation_result = data["translations"][0]["text"];

            // 翻訳結果の数式に実際の数式を代入
            for (let i = 0; i < equation_list.length; i++) {

                equation = equation_list[i];

                substi = substi_pre + String(i).padStart(len_substi_num, '0');
                translation_result = translation_result.replace(substi, equation);
            }

            document.getElementById('result').textContent = translation_result;
            MathJax.typesetPromise()

        }).catch(function(error) {
            document.getElementById('result').textContent = error.message;
        });
}

function resetTextbox() {
    
    document.getElementById("input_code").value = "";
    document.getElementById("result").textContent = "";
}