function resetTextbox() {
    
    document.getElementById("input_code").value = "";
    document.getElementById("result").textContent = "";
}

function runTranslation() {
    const API_URL = 'https://api-free.deepl.com/v2/translate';

    let substi_sets = {pre:"EQ", pre_small:"eq", len_num: 2, cnt: 0};
    let substi_sand_sets = {pre:"SW", len_num: 2, cnt: 0};

    // 初期化
    let idx = 0;
    let idx_equation_start = 0;
    let idx_equation_end = 0;

    let equation = "";

    let is_inline_eq = false;

    let sandwich_list = [];
    let replaced_sandwich_list = [];

    let replaced_string = "";
    let equation_list = [];
    let replaced_equation_list = [];

    let r = [];
    
    let api_elm = document.getElementById("deepl_api_key");
    const API_KEY = api_elm.value;

    let have_api_key = API_KEY != "";

    if (have_api_key) {
        document.getElementById("warning_api_key").style.display = "none";

        if (api_elm.classList.contains("is-danger")) {

            api_elm.classList.remove("is-danger");
            api_elm.classList.add("is-info");
            api_elm.style.backgroundColor = "white";

        }        

    } else {

        document.getElementById("warning_api_key").style.display = "block";
        document.getElementById('warning_api_key').innerHTML = "<a href='https://www.deepl.com/pro#developer'>このリンク</a>からDeepLのAPIキーを取得し，右上の欄に入力してください．";

        api_elm.classList.remove("is-info");
        api_elm.classList.add("is-danger");
        api_elm.style.backgroundColor = "#ffecf4";
        
        document.getElementById('result').textContent = "";

        return;

    }

    let latex_code = document.getElementById("input_code").value;

    latex_code = preprocessLatexCode(latex_code);

    // 数式を一旦equation_listに保管して，EQxxで置き換える
    // 置換後のテキストはsubsti_code_listに入れる
    while (true) {

        r = extractFirstEquation(latex_code.slice(idx));
        [equation, is_inline_eq, idx_equation_start, idx_equation_end] = r;
        idx_equation_start = idx_equation_start + idx;
        idx_equation_end   = idx_equation_end + idx;

        if (equation == ""){
            break;
        }

        equation = changeEquationForMathjax(equation, is_inline_eq);

        [equation, replaced_sandwich_list] = replaceSandwichWithSubsti(equation, substi_sand_sets);
        sandwich_list = sandwich_list.concat(replaced_sandwich_list);

        [replaced_string, replaced_equation_list] = replaceEquationWithSubsti(equation, is_inline_eq, substi_sets);
        equation_list = equation_list.concat(replaced_equation_list);

        latex_code = latex_code.slice(0, idx_equation_start) + replaced_string + latex_code.slice(idx_equation_end + 1);

        idx = idx_equation_start + replaced_string.length;
    }

    // 翻訳
    let url = API_URL + '?' + encodeURI('auth_key=' + API_KEY + '&text=' + latex_code + '&source_lang=EN&target_lang=JA');
  
    fetch(url)
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {

                document.getElementById("warning_api_key").style.display = "block";
                document.getElementById('warning_api_key').innerHTML = "DeepL APIにアクセスできません。以下の内容についてチェックしてください。<ul><li>APIキーが正確か→<a href='https://www.deepl.com/ja/account/summary'>アカウント</a></li><li>利用可能文字数が最大に達していないか→<a href='https://www.deepl.com/ja/account/usage'>ご利用状況</a></li><li>インターネットが正しく接続されているか</li></ul>";
            
            }
        }).then(function (data) {
            
            let translation_result = data["translations"][0]["text"];

            translation_result = replaceSubstiWithStringList(translation_result, equation_list, substi_sets);
            translation_result = replaceSubstiWithStringList(translation_result, sandwich_list, substi_sand_sets);

            document.getElementById('result').textContent = translation_result;
            MathJax.typesetPromise()

            goOutputSection();

        }).catch(function(error) {
            document.getElementById('result').textContent = error.message;
        });
}

function preprocessLatexCode(latex_code) {
    // LaTeXでは1回の改行は無視されて，2回の改行でやっと改行になるという仕様に対応するため，
    // 1改行の改行は削除して，2回の改行はそのままにする．
    // すべてのピリオドの後に空白を追加する．
    
    let idx_newline = 0;
    let new_latex_code = "";

    while (true) {
        idx_newline = latex_code.search(/[^\n]\n[^\n]/);

        if (idx_newline == -1) {
            new_latex_code = new_latex_code + latex_code;
            break;
        }

        new_latex_code = new_latex_code + latex_code.slice(0, idx_newline + 1) + " ";
        latex_code = latex_code.slice(idx_newline + 2);

        idx_newline = idx_newline + 1;
    }

    return new_latex_code
}

function extractFirstEquation(latex_code) {

    let equation = "";
    let is_inline_eq = true;
    let idx_equation_start = 0;
    let idx_equation_end = 0;

    let idx_first_dollar  = latex_code.indexOf('$');
    let idx_second_dollar = latex_code.indexOf('$', idx_first_dollar + 1);

    if (idx_first_dollar != -1) {

        is_inline_eq = (idx_second_dollar - idx_first_dollar != 1);
    
        if (is_inline_eq) {
            
            idx_equation_start = idx_first_dollar;
            idx_equation_end = idx_second_dollar;
            
        } else {
    
            idx_equation_start = idx_first_dollar;
            idx_equation_end = latex_code.indexOf('$', idx_second_dollar + 1) + 1;
    
        }
    
        equation = latex_code.slice(idx_equation_start, idx_equation_end + 1);

    }

    return [equation, is_inline_eq, idx_equation_start, idx_equation_end];

}

function replaceSandwichWithSubsti(string, substi_sand_sets) {
    // Function:
    //      ペアとなる文字列（\left, \rightなど）によって挟まれた部分（sandwich）を文字列で置き換える．
    //      ただし，サンドイッチの中にサンドイッチがある場合は，外側のサンドイッチだけを置き換える．
    // Input:
    //      string               (string): 入力文字列
    //      substi_sand_sets     (object): 挟まれた部分を置き換える代替に関する情報
    // Output:
    //      replaced_string      (string): 置き換えられた文字列
    //      replaced_sandwich_list (list): 置き換えられた部分のリスト
    // e.g.
    //      replaceSandwichWithSubsti("\\( a_\{b, c\} \\)", substi_sand_sets) => ["\\( a_SW00 \\)", ["\{b, c\}"]] 
    //      replaceSandwichWithSubsti("\\( \\left \( a, b, c \\right \) \\)", substi_sand_sets) => ["\\( SW01 \) \\)", ["\\left \( a, b, c \\right"]] 
    //      replaceSandwichWithSubsti("\\( \\left \( a_\{b, c\}, d, e \\right \) \\)", substi_sand_sets) => ["\\( SW01 \) \\)", ["\\left \( a_\{b, c\}, d, e \\right"]] 
    
    const search_list = ["\\left", "\\right", "\{", "\}"];
    const pair_list = [{first_part: "\\left", second_part: "\\right"}, {first_part: "\{", second_part: "\}"}];

    let replaced_string = "";
    let replaced_sandwich_list = [];
    let idx_start = 0;

    let idx_sandwich_list = indexOutermostPair(string, pair_list);

    for (let i = 0; i < idx_sandwich_list.length; i++) {

        replaced_sandwich_list.push(string.slice(idx_sandwich_list[i].idx_head, idx_sandwich_list[i].idx_end + 1));
        replaced_string = replaced_string + string.slice(idx_start, idx_sandwich_list[i].idx_head) + getSubstiString(substi_sand_sets);
        idx_start = idx_sandwich_list[i].idx_end + 1;
    }

    replaced_string = replaced_string + string.slice(idx_start, string.length);

    return [replaced_string, replaced_sandwich_list];
}

function indexOutermostPair(string, pair_list) {
    // Function:
    //      文字列string中のペアとなる文字列（\left, \rightなど）によって挟まれた部分（sandwich）の始めのインデックスと最後のインデックスをオブジェクトとし，
    //      全てを配列に格納して返す．
    // Input:
    //      string          (string): 入力文字列
    //      pair_list         (list): ペア
    // Output:
    //      obj_idx_sandwich_list     (list): sandwichの始めのインデックスと最後のインデックスをオブジェクトにして，配列にまとめたもの
    // e.g.
    //      string = "\\( \\left \( a_\{b, c\}, d, e \\right \) f_\{g\} \\)";
    //      pair_list = [{first_part: "\\left", second_part: "\\right"}, {first_part: "\{", second_part: "\}"}];
    //      indexOutermostPair(string, pair_list) => [{idx_head: 3, idx_end: 31}, {idx_head: 37, idx_end: 39}];
    
    let search_list = [];
    let first_part_list = [];
    let index_object = {};
    
    let idx_sandwich_list = [];

    for (let i = 0; i < pair_list.length; i++) {

        search_list.push(pair_list[i].first_part);
        search_list.push(pair_list[i].second_part);
        
        first_part_list.push(pair_list[i].first_part);

    }

    let index_object_list = allIndexOfList(string, search_list);

    
    // first_partだったら +1, second_partだったら -1，point==0だったら最も外側ということ．
    let point = 0;

    for (i = 0; i < index_object_list.length; i++) {

        index_object = index_object_list[i];

        if (first_part_list.includes(index_object.str)) {

            if (point == 0) {

                idx_sandwich_list.push(index_object.idx);
    
            }
            
            point = point + 1;

        } else {

            point = point - 1;

            if (point == 0) {
    
                idx_sandwich_list.push(index_object.idx + index_object.str.length - 1);
    
            }
        }
    }
    
    // ただインデックスを入れただけのidx_sandwich_listを，sandwichの始めと最後を区別して，オブジェクトにする．
    // idx_sandwich_listの中身は，頭・尾・頭・尾の順に並んでいるので，それを活かす．
    let is_head = true;
    let obj_sandwich = {};
    let obj_idx_sandwich_list = [];

    for (let i = 0; i < idx_sandwich_list.length; i++) {

        if (is_head) {

            obj_sandwich.idx_head = idx_sandwich_list[i];
            is_head = false;

        } else {

            obj_sandwich.idx_end = idx_sandwich_list[i];
            obj_idx_sandwich_list.push(obj_sandwich)
            is_head = true;
            obj_sandwich = {};

        }
    }

    return obj_idx_sandwich_list;
}


function allIndexOfList(string, search_list) {
    // Function:
    //      文字列string中の検索対象search_listの各要素のインデックスを示す．
    // Input:
    //      string          (string): 入力文字列
    //      search_all_list (list): 検索対象の配列
    // Output:
    //      index_object_list: 検索結果をオブジェクト{idx: xx, str: yy}のリストで返す．また，そのリストはidxについての昇順で並んでいる．
    // e.g.
    //      string = "\\( \\left \( a_\{b, c\}, d, e \\right \) \\)";
    //      search_list = ["\\left", "\\right", "\{", "\}"];
    //      allIndexOfList(string, search_list) => [{idx:3, str:"\\left"}, {idx:13, str:"\{"}}, {idx:18, str:"\}"}, {idx:26, str:"\\right"}]
    
    let search_string = "";
    let idx_start = 0;
    let idx_result = 0;
    let result_object = {};
    let result_object_list = [];

    for (let i = 0; i < search_list.length; i++) {

        idx_start = 0;
        search_string = search_list[i];

        while (true) {
            
            idx_result = string.indexOf(search_string, idx_start);
            if (idx_result == -1) {
                break;
            }

            result_object = {
                idx: idx_result,
                str: search_string
            };

            idx_start = idx_result + 1;

            result_object_list.push(result_object);

        }

    }
    
    result_object_list = result_object_list.sort((a, b) => a.idx - b.idx);

    return result_object_list;

}

function replaceEquationWithSubsti(equation, is_inline_eq, substi_sets) {
    // Function:
    //      数式の文字列を，文字列に置き換える．ただし，句読点の前後で文字列を分割する．
    // Input:
    //      equation   (string): 数式の文字列
    //      is_inline_eq (bool): インライン数式かどうか
    //      substi_set (object): 代替に関する情報
    // Output: 
    //      replaced_equation (string): 数式を代替記号 (EQxxx)で置き換えた後の文字列
    //      equation_list (list): 数式の文字列の配列
    // e.g.
    //      replaceEquationWithSubsti("\\(a, b\\)", true, substi_sets) => ["EQ00, EQ001", ["\\(a\\)", "\\(b\\)"]]

    let substi_code_list = [];
    let reduced_equation = "";
    let separated_equation = "";
    let equation_list = [];

    let str_punc = "";
    let idx_punc = 0;

    let substi = "";

    // 数式内にカンマ・ピリオドがある場合，前後で分割して，2つの数式にする
    if (is_inline_eq) {

        reduced_equation = equation;
        separated_equation = "";

        while (true) {

            [separated_equation, reduced_equation, str_punc, idx_punc] = splitEquationBeforeAndAfterSymbol(reduced_equation, /\.|,|;/, is_inline_eq);

            if (idx_punc == -1) {
                break;
            }

            substi = getSubstiString(substi_sets);

            substi_code_list.push(substi);
            substi_code_list.push(str_punc);
            substi_code_list.push(" ");

            equation_list.push(separated_equation);

        }

        // 空白だけの数式の時のみ処理
        if (!/^\\(\(|\[)\s*\\(\)|\])$/.test(reduced_equation)) {

            substi = getSubstiString(substi_sets);

            substi_code_list.push(substi);
            equation_list.push(reduced_equation);
            
        }

    } else {

        // 数式の末尾にカンマ・ピリオドがある場合のみ，それを数式の外に出す．
        idx_punc = equation.search(/(\.|,|;)\s*\\]/);
        no_end_punc = (idx_punc == -1);

        substi = getSubstiString(substi_sets);
        
        if (no_end_punc) {

            // ブロック数式の場合，前後に空白がない事が多いので，空白を入れる．
            substi_code_list.push(" ");
            substi_code_list.push(substi);
            substi_code_list.push(" ");
            equation_list.push(equation);
            
        } else {
            str_punc = equation[idx_punc];

            substi_code_list.push(" ");
            substi_code_list.push(substi);
            substi_code_list.push(str_punc);
            substi_code_list.push(" ");

            // 数式からカンマ・ピリオドを抜く
            equation = equation.slice(0, idx_punc) + " \\]";
            equation_list.push(equation);

        }    
    }

    let replaced_equation = substi_code_list.join("");

    return [replaced_equation, equation_list];

}

function changeEquationForMathjax(equation, is_inline_eq) {

    if (is_inline_eq) {

        equation = "\\(" + equation.slice(1, equation.length - 1) + "\\)";

    } else {

        equation = "\\[" + equation.slice(2, equation.length - 2) + "\\]";

    }

    return equation  

}

function splitEquationBeforeAndAfterSymbol(equation, symbol_reg, is_inline_eq) {

    let first_equation = "";
    let second_equation = "";
    let str_symbol = "";

    let idx_symbol = equation.search(symbol_reg);

    if (idx_symbol != -1) {

        str_symbol = equation[idx_symbol];
    
        // str_symbolの前をfirst_equation, 後をsecond_equationとする
        // reduced_equation -> separated_equation + punctuation + reduced_equation
        first_equation = equation.slice(0, idx_symbol);
        second_equation = equation.slice(idx_symbol + 1);
    
        // 分割するだけでは，\( \)の記号も分割されてしまいエラーが出るので，付け足す
        // e.g.
        // separated_equation : \( xxxx  -> \( xxxx \)
        // reduced_equation   :  xxxx \) -> \( xxxx \)
    
        if (is_inline_eq) {
    
            first_equation = first_equation + "\\)";
            second_equation = "\\(" + second_equation;
    
        } else {
    
            first_equation = first_equation + "\\]";
            second_equation = "\\[" + second_equation;
    
        }

    } else {
        second_equation = equation;
    }

    return [first_equation, second_equation, str_symbol, idx_symbol]

}

function getSubstiString(substi_sets) {

    let cnt = substi_sets.cnt;
    substi = substi_sets.pre + String(cnt).padStart(substi_sets.len_num, '0');
    cnt = cnt + 1;
    substi_sets.cnt = cnt;

    return substi
}

function getSubstiStringIdx(substi_sets, idx) {

    substi = substi_sets.pre + String(idx).padStart(substi_sets.len_num, '0');

    return substi
}

function getSubstiStringIdxSmall(substi_sets, idx) {

    substi = substi_sets.pre_small + String(idx).padStart(substi_sets.len_num, '0');

    return substi
}

function replaceSubstiWithStringList(text, string_list, substi_sets) {

    let string = "";
    let substi = "";

    for (let i = 0; i < string_list.length; i++) {

        string = string_list[i];

        substi = getSubstiStringIdx(substi_sets, i);
        text = text.replace(substi, string);

        // たまに翻訳によって，"EQxxxx"から"eqxxxx"になることがあるので．
        substi = getSubstiStringIdxSmall(substi_sets, i);
        text = text.replace(substi, string);
    }

    return text
}

function goOutputSection() {

    const output_pos = document.getElementById("output").getBoundingClientRect().top;

    window.scrollTo({
        top: output_pos,
        behavior: 'smooth'
    });

}

function captureOutput() {
    html2canvas(document.getElementById("result")).then((canvas) => {
        const link = document.createElement('a')
        link.href = canvas.toDataURL()
        link.download = `result.png`
        link.click()
    })
}