function runTranslation() {
    const API_URL = 'https://api-free.deepl.com/v2/translate';

    const substi_pre = "EQ";
    const substi_pre_small = "eq";
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

    // 数式を一旦equation_listに保管して，EQxxで置き換える
    // 置換後のテキストはsubsti_code_listに入れる
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

        substi_code_list = [];

        if (is_inline_eq) {

            reduced_equation = equation;
            separated_equation = "";

            // 数式内にカンマ・ピリオドがある場合，前後で分割して，2つの数式にする
            while (true) {

                idx_punc = reduced_equation.search(/\.|,|;|:/);
                if (idx_punc == -1) {
                    break;
                }

                str_punc = reduced_equation[idx_punc];

                // カンマ・ピリオドの前をseparated_equation, 後をreduced_equationとする
                // reduced_equation -> separated_equation + punctuation + reduced_equation
                separated_equation = reduced_equation.slice(0, idx_punc);
                reduced_equation = reduced_equation.slice(idx_punc + 1);

                // 分割するだけでは，\( \)の記号も分割されてしまいエラーが出るので，付け足す
                // e.g.
                // separated_equation : \( xxxx  -> \( xxxx \)
                // reduced_equation   :  xxxx \) -> \( xxxx \)
                separated_equation = separated_equation + "\\)";
                reduced_equation = "\\(" + reduced_equation;
                
                // 等式が\left または \right を含む場合，カンマ・ピリオドによって分断されるとエラーが出るので，それの対策．
                separated_equation = keepLeftRightPair(separated_equation);

                // separated_equationをequation_listに，separated_equationに対する代替（EQxxxx）をsubsti_code_listに入れる
                substi = substi_pre + String(cnt).padStart(len_substi_num, '0');
                cnt = cnt + 1;

                substi_code_list.push(substi);
                substi_code_list.push(str_punc);
                substi_code_list.push(" ");

                equation_list.push(separated_equation);

            }

            // separated_equationについてもseparated_equationと同様の処理をする
            if (!/^\\(\(|\[)\s*\\(\)|\])$/.test(reduced_equation)) {

                // 等式が\left または \right を含む場合，カンマ・ピリオドによって分断されるとエラーが出るので，それの対策．
                reduced_equation = keepLeftRightPair(reduced_equation);

                // 数式を代替（EQxxxx）に変換．
                substi = substi_pre + String(cnt).padStart(len_substi_num, '0');
                cnt = cnt + 1;

                substi_code_list.push(substi);
                equation_list.push(reduced_equation);
                
            }

        // インライン数式でないなら，カンマ・ピリオド前後で分割する必要はない．
        // 数式の末尾にカンマ・ピリオドがある場合のみ，それを数式の外に出す．
        } else {

            idx_punc = equation.search(/(\.|,|;|:)\s*\\\\]/);
            no_end_punc = (idx_punc == -1);

            // 数式を代替（EQxxxx）に変換．
            substi = substi_pre + String(cnt).padStart(len_substi_num, '0');
            cnt = cnt + 1;
            
            if (no_end_punc) {

                substi_code_list.push(substi);
                equation_list.push(equation);
                
            } else {
                str_punc = equation[idx_punc];

                substi_code_list.push(substi);
                substi_code_list.push(str_punc);
                substi_code_list.push(" ");

                // 数式からカンマ・ピリオドを抜く
                equation = equation.slice(0, idx_punc) + " //]";
                equation_list.push(equation);

            }    
        }

        // 配列として蓄えていた代替（EQxxxx）を実際の文字列に入れる
        latex_code = latex_code.slice(0, idx_start) + " " + substi_code_list.join("") + " " + latex_code.slice(idx_end + 1);
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

            // 翻訳結果の記号EQxxに実際の数式を代入
            for (let i = 0; i < equation_list.length; i++) {

                equation = equation_list[i];

                substi = substi_pre + String(i).padStart(len_substi_num, '0');
                translation_result = translation_result.replace(substi, equation);

                // たまに翻訳によって，"EQxxxx"から"eqxxxx"になることがあるので．
                substi = substi_pre_small + String(i).padStart(len_substi_num, '0');
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

function keepLeftRightPair(equation) {

    let n_left  = (equation.match(/\\left[^a-z]/g)  || []).length;
    let n_right = (equation.match(/\\right[^a-z]/g) || []).length;
    let len_equation = equation.length;
    let len_equation_bra = 2; // the length of \\[ or \\]

    if (n_left == n_right) {
        ;
    } else if (n_left > n_right) {
        equation = equation.slice(0, len_equation - len_equation_bra) + " \\right . " + equation.slice(len_equation - len_equation_bra);
    } else {
        equation = equation.slice(0, len_equation_bra) + " \\left . " + equation.slice(2);
    }

    return equation

}