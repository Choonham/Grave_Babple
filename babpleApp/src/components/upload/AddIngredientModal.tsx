import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, borderRadius} from '../../styles/commonStyles';

interface AddIngredientModalProps {
  ingredientName: string;
  onClose: () => void;
  onAdd: (ingredient: {name: string; category?: string; unit: string}) => void;
}

const AddIngredientModal: React.FC<AddIngredientModalProps> = ({
  ingredientName,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState(ingredientName);
  const [selectedUnit, setSelectedUnit] = useState('g');

  useEffect(() => {
    setName(ingredientName);
  }, [ingredientName]);

  const units = ['g', 'mg', '개', '컵', 'ml', 'L', '큰술', '작은술', '꼬집', '방울'];

  const handleAdd = async () => {
    if (!onAdd) {
      console.error('❌ [AddIngredientModal] onAdd 함수가 정의되지 않았습니다.');
      return;
    }

    try {
      // onAdd가 Promise를 반환할 수 있으므로 await 처리
      if (typeof onAdd === 'function') {
        await onAdd({
          name,
          unit: selectedUnit,
        });
        // 성공적으로 완료된 후에만 모달 닫기
        onClose();
      } else {
        console.error('❌ [AddIngredientModal] onAdd가 함수가 아닙니다:', typeof onAdd);
      }
    } catch (error) {
      console.error('❌ [AddIngredientModal] 재료 추가 중 오류:', error);
      // 에러가 발생해도 모달은 열어두어 사용자가 다시 시도할 수 있도록 함
      // onClose는 호출하지 않음
    }
  };

  return (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>새로운 재료 추가</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.inputSection}>
          <View style={styles.labelInputRow}>
            <Text style={styles.label}>재료 이름</Text>
            <TextInput
              style={[styles.input, styles.inputReadonly]}
              value={name}
              editable={false}
              pointerEvents="none"
            />
          </View>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.labelInputRow}>
            <Text style={styles.label}>단위</Text>
          </View>
          <View style={styles.unitGrid}>
            {units.map((unit, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.unitButton,
                  selectedUnit === unit && styles.unitButtonSelected,
                ]}
                onPress={() => setSelectedUnit(unit)}>
                <Text
                  style={[
                    styles.unitButtonText,
                    selectedUnit === unit && styles.unitButtonTextSelected,
                  ]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
        <Text style={styles.addButtonText}>추가하기</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: spacing.l,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    maxHeight: 500,
  },
  inputSection: {
    marginBottom: spacing.l,
  },
  labelInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: spacing.m,
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.m,
  },
  inputReadonly: {
    backgroundColor: colors.white,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: spacing.m,
    flex: 1,
    marginLeft: spacing.m,
  },
  dropdownText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    marginTop: spacing.s,
  },
  unitButton: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  unitButtonText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  unitButtonTextSelected: {
    color: colors.white,
  },
  addButton: {
    paddingVertical: spacing.m,
    borderRadius: borderRadius.s,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.l,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
});

export default AddIngredientModal;

