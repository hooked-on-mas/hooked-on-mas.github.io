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

    let whole_result = "";
    let latex_code_para = "";
    let idx_new_line = 0;
    let idx_new_line_pre = 0;
    let flag_end = false;

    const API_KEY = document.getElementById("deepl_api_key").value;
    if (API_KEY == "") {
        document.getElementById('result').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，入力してください．.";
        return;
    }

    let latex_code = document.getElementById("input_code").value;

    // 段落ごとに翻訳していく
    while (true) {
        
        idx_new_line = latex_code.indexOf('\n', idx_new_line);

        if (idx_new_line == -1) {
            flag_end = true;
        }

        latex_code_para = latex_code.slice(idx_new_line_pre, idx_new_line);
        idx_new_line_pre = idx_new_line + 1;
        idx_new_line = idx_new_line + 1;

        // 数式を記号で置き換える
        while(true){
            idx_start = latex_code_para.indexOf('$', idx);
            idx_end = latex_code_para.indexOf('$', idx_start + 1);

            // これ以上数式がなければ，ループを終了
            if (idx_start == -1){
                break;
            }

            // 数式をMathjax向けに変更．
            // 別行立て数式の場合
            if (idx_end - idx_start == 1){
                idx_end = latex_code_para.indexOf('$', idx_end + 1) + 1;
                equation = latex_code_para.slice(idx_start, idx_end + 1);

                // $$...$$を\[...\]に変換
                equation = "\\[" + equation.slice(2, equation.length - 2) + "\\]";

                is_inline_eq = false;
                
            // インライン数式の場合
            } else {
                equation = latex_code_para.slice(idx_start, idx_end + 1);
                
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

            latex_code_para = latex_code_para.slice(0, idx_start) + substi_code_list.join("") + latex_code_para.slice(idx_end + 1, latex_code_para.length);

            idx = idx_start + substi_code_list.join("").length;
        }

        latex_code_para = latex_code_para.replace(/\r?\n/g, ' ');

        // 翻訳
        let content = encodeURI('auth_key=' + API_KEY + '&text=' + latex_code_para + '&source_lang=EN&target_lang=JA');
        let url = API_URL + '?' + content;

        let translation_result = "";
        
        const aaa = async () => {

            await fetch(url)
            .then(function(response) {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error("APIのプランをチェックしてください。");
                }
            }).then(function(data) {
                translation_result = data["translations"][0]["text"];

                // 翻訳結果の数式に実際の数式を代入
                for (let i = 0; i < equation_list.length; i++) {

                    equation = equation_list[i];

                    substi = substi_pre + String(i).padStart(len_substi_num, '0');
                    translation_result = translation_result.replace(substi, equation);
                }

                whole_result = whole_result + "\n" + translation_result;

                document.getElementById('result').textContent = whole_result;

            }).catch(function(error) {
                document.getElementById('result').textContent = error.message;
            });
        }
        aaa();
            
        if (flag_end == true) {
            MathJax.typesetPromise()
            break;
        }
    }    
}

function resetTextbox() {
    
    document.getElementById("input_code").value = "";
    document.getElementById("result").textContent = "";
}

function replaceNewlineWithLf(str) {

    idx = 0;

    while (true) {
        
        idx = str.indexOf('\n', idx);

        if (idx == -1) {
            break;
        }
        
        str = str.slice(0, idx) + " LF. " + str.slice(idx + 2, str.length);
        idx = idx + 1;

    }

    return str
}

function replaceLfWithNewline(str) {

    idx = 0;

    while (true) {
        
        idx = str.indexOf('LF.', idx);

        if (idx == -1) {
            break;
        }
        
        str = str.slice(0, idx - 1) + "\n" + str.slice(idx + 2, str.length);
        idx = idx + 1;

    }

    return str
}