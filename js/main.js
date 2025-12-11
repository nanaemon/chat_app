     // ------------ ◾firebaseの設定 ----------------------------------   
    // Import the functions you need from the SDKs you need
    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.1.0/firebase-app.js";
    import { getDatabase, ref, push, set, onChildAdded, remove, onChildRemoved, update }
        from "https://www.gstatic.com/firebasejs/9.1.0/firebase-database.js";
    // Your web app's Firebase configuration
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional

    // Firebase接続フラグ
    let db = null;
    let dbRef = null;
    let firebaseEnabled = true;

    // TODO：Gitには削除してからUPすること
    try {
      const firebaseConfig = {}; 
      const app = initializeApp(firebaseConfig);
      db = getDatabase(app); //RealtimeDBに接続
      dbRef = ref(db, "columns"); //RealtimeDB内の"columns"を使う
    } catch (e) {
      console.warn("Firebaseが無効です（デモモードで表示のみ動作）");
      firebaseEnabled = false;
    }

    // -------------ジャンル選択時に表示する感情リスト---------------------
    const emotionList = {
      negative: ["不安", "悲しい", "イライラ", "しんどい"],
      neutral: ["普通", "ぼんやり", "無感情"],
      positive: ["安心", "穏やか", "嬉しい"]
    };

    // 感情ジャンル変更 → 感情プルダウンの中身を入れ替え
    $("#emotionCategory").on("change", function () {
      // 選択したジャンル  
      const category = $(this).val();
      // 事前にリセットする
      $("#emotion").empty();

      // カテゴリーが選択されていない場合  
      if (!category) {
        $("#emotion").append('<option value="">ジャンルを選んでください</option>');
        return;
      }

      // 選択したジャンルのリストの中身を出力する 
      emotionList[category].forEach(em => {
        $("#emotion").append(`<option value="${em}">${em}</option>`);
      });
    });

    // -------------1件分のレコードをカードとして #output に追加-------------
    // 編集ボタンを押した時に対象のデータIDを格納する
    let editTargetKey = null;   // 編集対象の Firebaseキー
    const records = {};         // key → data を保存しておく

    function addRecord(key, data) {

      // ローカルで保持しておく（編集用）
      records[key] = data;

      const {
        situation,
        emotionCategory,
        emotion,
        automaticThought,
        distortion,
        reframe,
        outcome
      } = data;

      const html = `
        <div class="record"
             data-key="${key}"
             data-category="${emotionCategory}"
             data-emotion="${emotion}">
          <p><strong>感情：</strong>${emotion}</p>
          <p><strong>状況：</strong>${situation}</p>
          <p><strong>自動思考：</strong>${automaticThought}</p>
          <p><strong>認知の歪み：</strong>${distortion}</p>
          <p><strong>客観視点：</strong>${reframe}</p>
          <p><strong>結果：</strong>${outcome}</p>
          <div class="actions">
            <button class="edit"><span class="material-icons">edit</span></button>
            <button class="delete"><span class="material-icons">delete</span></button>
          </div>
        </div>
      `;
      $("#output").append(html);
    }

    // ============= 登録機能（①新規、②更新時の上書き） =============
    $("#save").on("click", function () {
      const data = {
        situation: $("#situation").val(),
        emotionCategory: $("#emotionCategory").val(),
        emotion: $("#emotion").val(),
        automaticThought: $("#automaticThought").val(),
        distortion: $("#distortion").val(),
        reframe: $("#reframe").val(),
        outcome: $("#outcome").val()
      };

      // ----------簡易バリデーション----------
      if (!data.emotionCategory || !data.emotion || !data.situation) {
        alert("状況と感情ジャンル・感情は入力してください");
        return;
      }

      // ②編集ボタン押下後に保存したとき
      if (editTargetKey) {
        // ★ 編集モード：既存データを更新
        const targetRef = ref(db, `columns/${editTargetKey}`);
        update(targetRef, data);

        // 手元のデータも更新
        records[editTargetKey] = data;

        // 画面上のカードも作り直す（いったん消してから addRecord）
        const $old = $(`.record[data-key="${editTargetKey}"]`);
        $old.remove();
        addRecord(editTargetKey, data);

        // 編集モード解除
        editTargetKey = null;
        $("#save").text("登録");

      // ①登録  
      } else {
          // ----------Firebaseに保存----------
          // Firebaseに新しい場所を作って保存
          if (firebaseEnabled) {
            const newPostRef = push(dbRef); 
            set(newPostRef, data);    
          }
      }       

      // ----------入力欄をリセット----------
      $("#situation").val("");
      $("#automaticThought").val("");
      $("#distortion").val("");
      $("#reframe").val("");
      $("#outcome").val("");
      $("#emotionCategory").val("");
      $("#emotion").empty().append('<option value="">先にジャンルを選んでください</option>');
    });

    // ============= リアルタイムで一覧に表示する =============
    // Firebase上でデータが追加されたら画面にも追加
    if (firebaseEnabled) {
      onChildAdded(dbRef, function(snapshot){
          const key  = snapshot.key;   // Firebaseが付けたユニークID
          const data = snapshot.val(); // 中身のオブジェクト

          // 最初の1回だけ見出しを挿入
          insertListTitle();  
          // 一覧を表示
          $("#output").show();
          addRecord(key, data);     
      });
    }

    // ============= 削除機能 =============
    // 削除ボタン
    $(document).on("click", ".delete", function () {
      // クリックされた「削除ボタン」の一番近い親要素を取得
      const $card = $(this).closest(".record");// Jsで生成した要素なので＄をつけて明示的にする
      // Firebase のキーを取り出す
      const key = $card.data("key");

      // 削除確認ダイアログ
      if (!confirm("この記録を削除しますか？")) return;

      // Firebase から削除
      remove(ref(db, `columns/${key}`));

      // 画面からも削除
      $card.remove();

      // 編集用項目はリセット
      delete records[key];

      // ０件の場合は見出しを削除
      checkEmptyList();

      // もし編集中のものを消したなら編集モード解除
      if (editTargetKey === key) {
        editTargetKey = null;
        $("#save").text("記録する");
      }
    });

    // ============= 編集切り替え =============
    //　画面を編集モードへ切り替えるのみ、データの更新自体は登録機能で行う
    $(document).on("click", ".edit", function () {
      const $card = $(this).closest(".record");
      const key = $card.data("key");
      const data = records[key];

      // データがない場合は処理を行わない
      if (!data) return;

      // フォームに値をセット
      $("#situation").val(data.situation);
      $("#automaticThought").val(data.automaticThought);
      $("#distortion").val(data.distortion);
      $("#reframe").val(data.reframe);
      $("#outcome").val(data.outcome);

      // 感情ジャンル＋感情
      $("#emotionCategory").val(data.emotionCategory).trigger("change"); // ジャンル変更イベントを発火してリストを更新
      $("#emotion").val(data.emotion);  // そのあと感情をセット

      // 編集モードに入る
      editTargetKey = key;
      $("#save").text("更新する");
    });

    // ============= 一覧の見出し（登録された後に出したい） =============
    let titleInserted = false;

    function insertListTitle() {
      if (!titleInserted) {
        $("#output").prepend('<div class="list-title">【記録一覧】</div>');
        titleInserted = true;
      }
    }

    // ============= ０件チェック =============
    function checkEmptyList() {
      if ($(".record").length === 0) {
        $("#output").hide();  // 一覧領域ごと非表示
        $(".list-title").remove();  // 見出しを消す
        titleInserted = false;      // 次回また追加できるようにリセット
      }
    }
