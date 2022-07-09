function runTranslation() {
    const API_URL = 'https://api-free.deepl.com/v2/translate';

    const substi_pre = "EQ";
    const len_substi_num = 2;

    const list_exc_words = [",", ".", "\text"];
    const reg_exc_words  = /,|\.|\\text/;

    let equation_list = [];

    // 初期化
    let idx_deli = 0;
    let cnt = 0;

    let idx_start = 0;
    let idx_end = 0;
    let equation = "";
    let substi = "";
    let b_inline = true;

    let tmp_idx_end = 0;

    let idx_list_start_exc = [];    
    let word_exc = "";
    let equation_first = "";

    const API_KEY = document.getElementById("deepl_api_key").value;
    if (API_KEY == "") {
        document.getElementById('output').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，入力してください．.";
        return;
    }

    let latex_code = document.getElementById("input_code").value;

    while(true){
        console.log(idx_deli)
        idx_start = latex_code.indexOf('$', idx_deli);
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

            b_inline = false;
            
        // インライン数式の場合
        } else {
            equation = latex_code.slice(idx_start, idx_end + 1);
            
            // $...$を\(...\)に変換
            equation = "\\(" + equation.slice(1, equation.length - 1) + "\\)";

            b_inline = true;
        }

        // list_exc_wordsの中身がequation内にあった場合

        while(reg_exc_words.test(equation)){
            console.log(equation)

            idx_list_start_exc = [];
            for (let i = 0; i < list_exc_words.length; i++) {
                idx_list_start_exc.push(equation.indexOf(list_exc_words[i], 0));
            }

            idx_start_exc = Math.min(...idx_list_start_exc);                      // 排除すべき単語の始まりのインデックス
            word_exc = list_exc_words[idx_list_start_exc.indexOf(idx_start_exc)]; // 排除すべき単語
            idx_end_exc = idx_start_exc + word_exc.length;

            equation_first = equation.slice(0, idx_start_exc) + b_inline ? "\\)" : "\\]";

            // 排除すべき単語以前をequation_listに追加し，代替で置き換える．
            equation_list.push(equation_first);
            equation = equation.slice(idx_end_exc + 1, equation.length);

            tmp_idx_end = idx_end;
            idx_end = idx_start + (idx_start_exc - 1);
            latex_code = replaceEquationWithSub(latex_code, cnt, idx_start, idx_end, substi_pre, len_substi_num);
            cnt = cnt + 1;

            idx_end = tmp_idx_end;
            idx_start = idx_start + idx_end_exc + 1;
        }
    
        equation_list.push(equation);
        latex_code = replaceEquationWithSub(latex_code, cnt, idx_start, idx_end, substi_pre, len_substi_num);

        idx_deli = idx_start + substi_pre.length + len_substi_num;
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

// 数式をEQxxで置換
function replaceEquationWithSub(latex_code, cnt, idx_start, idx_end, substi_pre, len_substi_num) {

    let substi = substi_pre + String(cnt).padStart(len_substi_num, '0');

    return latex_code.slice(0, idx_start) + substi + latex_code.slice(idx_end+1, latex_code.length);

}