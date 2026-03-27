import json
import os

def convert_json_to_mcfunction(input_json_filepath, output_dir='outputs'):
    os.makedirs(output_dir, exist_ok=True)
    input_filename = os.path.basename(input_json_filepath)
    output_mcfunction_filename = os.path.splitext(input_filename)[0] + '.mcfunction'
    output_mcfunction_filepath = os.path.join(output_dir, output_mcfunction_filename)
    
    try:
        with open(input_json_filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f":white_check_mark: '{input_json_filepath}' の読み込みに成功しました。")
    except FileNotFoundError:
        print(f":x: エラー: '{input_json_filepath}' が見つかりません。")
        return None
    except json.JSONDecodeError:
        print(f":x: エラー: '{input_json_filepath}' は有効なJSONファイルではありません。")
        return None

    blocks_map = data.get('blocks', {})
    xyzi_data = data.get('xyzi', [])

    if not all([blocks_map, xyzi_data]):
        print(":x: エラー: JSONファイルに 'blocks' または 'xyzi' のデータがありません。")
        return None

    coords_to_block = {
        (x, y, z): blocks_map[str(i)]
        for x, y, z, i in xyzi_data
    }

    placed_coords = set()
    final_commands = []

    sorted_coords = sorted(coords_to_block.keys(), key=lambda c: (c[1], c[2], c[0]))

    for start_coord in sorted_coords:
        if start_coord in placed_coords:
            continue

        x_start, y_coord, z_coord = start_coord
        current_block_id = coords_to_block[start_coord]

        x_end = x_start
        while True:
            next_coord = (x_end + 1, y_coord, z_coord)
            if coords_to_block.get(next_coord) == current_block_id:
                x_end += 1
            else:
                break
        
        end_coord = (x_end, y_coord, z_coord)

        for x in range(x_start, x_end + 1):
            placed_coords.add((x, y_coord, z_coord))

        if start_coord == end_coord:
            command = f"setblock {start_coord[0]} {start_coord[1]} {start_coord[2]} {current_block_id}"
        else:
            command = f"fill {start_coord[0]} {start_coord[1]} {start_coord[2]} {end_coord[0]} {end_coord[1]} {end_coord[2]} {current_block_id}"
        
        final_commands.append(command)

    with open(output_mcfunction_filepath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(final_commands))

    print("-" * 30)
    print(" 変換が完了しました！ ")
    print(f"ブロック総数: {len(xyzi_data)}個")
    print(f"コマンド行数: {len(final_commands)}行")
    print(f"出力ファイル: '{output_mcfunction_filepath}'")
    
    return output_mcfunction_filepath

if __name__ == "__main__":
    # Webアプリケーションでは使用しないが、単体テスト用に残しておく
    INPUT_JSON_FILE = 'structure.json'
    convert_json_to_mcfunction(INPUT_JSON_FILE)