function resetTextbox() {
    
    document.getElementById("input_code").value = "";
    document.getElementById("result").textContent = "";
}

function runTranslation() {
    const API_URL = 'https://api-free.deepl.com/v2/translate';

    const substi_sets = {pre:"EQ", pre_small:"eq", len_num: 2};

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
    
    let api_elm = document.getElementById("deepl_api_key");
    const API_KEY = api_elm.value;

    if ((API_KEY != "") && (api_elm.classList.contains("is-primary"))) {
        document.getElementById("warning_api_key").style.display = "none";

    } else if (API_KEY == "") {
        document.getElementById("warning_api_key").style.display = "block";
        document.getElementById('warning_api_key').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，右上の欄に入力してください．";

        api_elm.classList.remove("is-primary");
        api_elm.classList.add("is-danger");
        api_elm.style.backgroundColor = "#ffecf4";
        return;

    } else if (api_elm.classList.contains("is-danger")) {
        document.getElementById("warning_api_key").style.display = "none";

        api_elm.classList.remove("is-danger");
        api_elm.classList.add("is-primary");
        api_elm.style.backgroundColor = "white";
    }

    let latex_code = document.getElementById("input_code").value;

    latex_code = preprocessLatexCode(latex_code);

    // 数式を一旦equation_listに保管して，EQxxで置き換える
    // 置換後のテキストはsubsti_code_listに入れる
    while (true) {
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

                idx_punc = reduced_equation.search(/\.|,|;/);
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
                substi = substi_sets.pre + String(cnt).padStart(substi_sets.len_num, '0');
                cnt = cnt + 1;

                substi_code_list.push(substi);
                substi_code_list.push(str_punc);

                equation_list.push(separated_equation);

            }

            // separated_equationについてもseparated_equationと同様の処理をする
            if (!/^\\(\(|\[)\s*\\(\)|\])$/.test(reduced_equation)) {

                // 等式が\left または \right を含む場合，カンマ・ピリオドによって分断されるとエラーが出るので，それの対策．
                reduced_equation = keepLeftRightPair(reduced_equation);

                // 数式を代替（EQxxxx）に変換．
                substi = substi_sets.pre + String(cnt).padStart(substi_sets.len_num, '0');
                cnt = cnt + 1;

                substi_code_list.push(substi);
                equation_list.push(reduced_equation);
                
            }

        // インライン数式でないなら，カンマ・ピリオド前後で分割する必要はない．
        // 数式の末尾にカンマ・ピリオドがある場合のみ，それを数式の外に出す．
        } else {

            idx_punc = equation.search(/(\.|,|;)\s*\\\\]/);
            no_end_punc = (idx_punc == -1);

            // 数式を代替（EQxxxx）に変換．
            substi = substi_sets.pre + String(cnt).padStart(substi_sets.len_num, '0');
            cnt = cnt + 1;
            
            if (no_end_punc) {

                substi_code_list.push(substi);
                equation_list.push(equation);
                
            } else {
                str_punc = equation[idx_punc];

                substi_code_list.push(substi);
                substi_code_list.push(str_punc);

                // 数式からカンマ・ピリオドを抜く
                equation = equation.slice(0, idx_punc) + " //]";
                equation_list.push(equation);

            }    
        }

        // 配列として蓄えていた代替（EQxxxx）を実際の文字列に入れる
        latex_code = latex_code.slice(0, idx_start) + " " + substi_code_list.join("") + " " + latex_code.slice(idx_end + 1);
        idx = idx_start + substi_code_list.join("").length;
    }

    console.log(latex_code)

    // 翻訳
    let url = API_URL + '?' + encodeURI('auth_key=' + API_KEY + '&text=' + latex_code + '&source_lang=EN&target_lang=JA');
  
    fetch(url)
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {
                throw new Error("DeepL APIにアクセスできません．");
            }
        }).then(function (data) {
            
            let translation_result = data["translations"][0]["text"];
            translation_result = replaceSubstiWithEquation(translation_result, equation_list, substi_sets);
            console.log(translation_result)


            document.getElementById('result').textContent = translation_result;
            MathJax.typesetPromise()

        }).catch(function(error) {
            document.getElementById('result').textContent = error.message;
        });
}

function preprocessLatexCode(latex_code) {
    // LaTeXでは1回の改行は無視されて，2回の改行でやっと改行になるという仕様に対応するため，
    // 1改行の改行は削除して，2回の改行はそのままにする．
    
    let idx_newline = 0;
    let new_latex_code = "";

    while (true) {
        idx_newline = latex_code.search(/[^\n]\n[^\n]/);

        if (idx_newline == -1) {
            new_latex_code = new_latex_code + latex_code;
            break;
        }

        new_latex_code = new_latex_code + latex_code.slice(0, idx_newline + 1);
        latex_code = latex_code.slice(idx_newline + 2);

        idx_newline = idx_newline + 1;
    }

    return new_latex_code
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

function replaceSubstiWithEquation(translation_result, equation_list, substi_sets) {
    // 翻訳結果の記号EQxxに実際の数式を代入

    let equation = "";
    let substi = "";

    for (let i = 0; i < equation_list.length; i++) {

        equation = equation_list[i];

        substi = substi_sets.pre + String(i).padStart(substi_sets.len_num, '0');
        translation_result = translation_result.replace(substi, equation);

        // たまに翻訳によって，"EQxxxx"から"eqxxxx"になることがあるので．
        substi = substi_sets.pre_small + String(i).padStart(substi_sets.len_num, '0');
        translation_result = translation_result.replace(substi, equation);
    }

    return translation_result
}